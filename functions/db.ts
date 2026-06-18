// D1 数据库工具函数

interface Site {
  id?: number
  name: string
  url: string
  icon?: string
  category?: string
  description?: string
  sort?: number
  created_at?: string
  updated_at?: string
}

interface SiteSubmission {
  id?: number
  name: string
  url: string
  icon?: string | null
  category?: string
  description?: string | null
  email: string
  status?: 'pending' | 'approved' | 'rejected'
  review_note?: string | null
  created_at?: string
  updated_at?: string
}

interface Shortcut {
  id?: number
  site_id?: number | null
  name: string
  url: string
  icon?: string | null
  sort?: number
  created_at?: string
  updated_at?: string
}

export const PRIVATE_CATEGORY_NAME = '隐私空间'

export function isPrivateCategory(category?: string | null) {
  return category === PRIVATE_CATEGORY_NAME
}

export function normalizeUrlInput(value: unknown) {
  if (typeof value !== 'string') return ''

  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  return `https://${trimmed}`
}

export function isValidHttpUrl(value: string) {
  try {
    const parsedUrl = new URL(value)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

export function normalizeUrlForCompare(value: unknown) {
  const normalizedInput = normalizeUrlInput(value)
  if (!normalizedInput) return ''

  try {
    const url = new URL(normalizedInput)
    url.hash = ''
    url.hostname = url.hostname.toLowerCase()

    if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) {
      url.port = ''
    }

    url.pathname = url.pathname.replace(/\/+$/, '') || '/'

    return url.toString().replace(/\/(?=\?|$)/, '')
  } catch {
    return normalizedInput.replace(/\/+$/, '')
  }
}

export async function findSiteByUrl(db: D1Database, url: string, excludeId?: number) {
  const normalizedUrl = normalizeUrlForCompare(url)
  if (!normalizedUrl) return null

  const { results } = await db.prepare('SELECT id, name, url FROM sites').all()
  const site = (results as unknown as Site[]).find((item) => {
    if (excludeId && item.id === excludeId) return false
    return normalizeUrlForCompare(item.url) === normalizedUrl
  })

  return site || null
}

export async function findPendingSubmissionByUrl(db: D1Database, url: string, excludeId?: number) {
  await ensureSubmissionsTable(db)
  const normalizedUrl = normalizeUrlForCompare(url)
  if (!normalizedUrl) return null

  const { results } = await db.prepare(
    'SELECT id, name, url, status FROM site_submissions WHERE status = ?'
  ).bind('pending').all()

  const submission = (results as unknown as SiteSubmission[]).find((item) => {
    if (excludeId && item.id === excludeId) return false
    return normalizeUrlForCompare(item.url) === normalizedUrl
  })

  return submission || null
}

async function ensureSubmissionsTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS site_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT,
      category TEXT DEFAULT '其他',
      description TEXT,
      email TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      review_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run()
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_site_submissions_status ON site_submissions(status, created_at DESC)').run()
}

export async function ensurePrivateCategory(db: D1Database) {
  await db.prepare('INSERT OR IGNORE INTO categories (name, sort) VALUES (?, -100)').bind(PRIVATE_CATEGORY_NAME).run()
}

interface Settings {
  siteTitle: string
  siteLogo: string
  theme: 'glass' | 'cyberpunk'
  background: {
    type: 'image' | 'particles'
    value: string
  }
  appearance: AppearanceConfig
  presets: SettingsPreset[]
}

interface AppearanceConfig {
  topbarBgColor: string
  topbarTextColor: string
  topbarBorderColor: string
  topbarOpacity: number
  topbarFontWeight: number
  menuBgColor: string
  menuActiveBgColor: string
  menuTextColor: string
  menuBorderColor: string
  menuOpacity: number
  menuFontWeight: number
  cardBgColor: string
  cardTextColor: string
  cardBorderColor: string
  cardOpacity: number
  cardFontWeight: number
}

interface SettingsPreset {
  id: string
  name: string
  siteTitle: string
  siteLogo: string
  theme: Settings['theme']
  background: Settings['background']
  appearance: AppearanceConfig
  createdAt: string
}

const defaultAppearance: AppearanceConfig = {
  topbarBgColor: '#0f172a',
  topbarTextColor: '#ffffff',
  topbarBorderColor: '#ffffff',
  topbarOpacity: 0.05,
  topbarFontWeight: 600,
  menuBgColor: '#0f172a',
  menuActiveBgColor: '#667eea',
  menuTextColor: '#ffffff',
  menuBorderColor: '#ffffff',
  menuOpacity: 0.03,
  menuFontWeight: 500,
  cardBgColor: '#0f172a',
  cardTextColor: '#ffffff',
  cardBorderColor: '#ffffff',
  cardOpacity: 0.1,
  cardFontWeight: 600
}

const legacyDefaultSiteTitle = '个人导航站'

const defaultSettings: Settings = {
  siteTitle: 'Nav',
  siteLogo: '',
  theme: 'glass',
  background: { type: 'particles', value: 'default' },
  appearance: { ...defaultAppearance },
  presets: []
}

async function ensureShortcutsTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS shortcuts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      icon TEXT,
      sort INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
    )
  `).run()
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_shortcuts_sort ON shortcuts(sort DESC, id ASC)').run()
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_shortcuts_site_id ON shortcuts(site_id)').run()
}

function normalizeTheme(value: unknown): Settings['theme'] {
  return value === 'cyberpunk' ? 'cyberpunk' : 'glass'
}

function normalizeSiteTitle(value: unknown): string {
  if (typeof value !== 'string') return defaultSettings.siteTitle

  const trimmed = value.trim()
  if (trimmed === legacyDefaultSiteTitle) return defaultSettings.siteTitle
  if (!trimmed) return ''

  return trimmed
}

function normalizeSiteLogo(value: unknown): string {
  if (typeof value !== 'string') return defaultSettings.siteLogo

  const trimmed = value.trim().slice(0, 500)
  if (!trimmed) return defaultSettings.siteLogo
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  return defaultSettings.siteLogo
}

function normalizeBackground(value: any): Settings['background'] {
  if (value?.type === 'image' && typeof value.value === 'string') {
    return {
      type: 'image',
      value: value.value
    }
  }

  return { ...defaultSettings.background }
}

function normalizeOpacity(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(1, Math.max(0, parsed))
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function normalizeFontWeight(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(900, Math.max(300, Math.round(parsed / 100) * 100))
}

function normalizeAppearance(value: any): Settings['appearance'] {
  if (value?.mode === 'readable') {
    return {
      topbarBgColor: '#0f172a',
      topbarTextColor: '#ffffff',
      topbarBorderColor: '#ffffff',
      topbarOpacity: 0.5,
      topbarFontWeight: 700,
      menuBgColor: '#0f172a',
      menuActiveBgColor: '#667eea',
      menuTextColor: '#ffffff',
      menuBorderColor: '#ffffff',
      menuOpacity: 0.42,
      menuFontWeight: 700,
      cardBgColor: '#0f172a',
      cardTextColor: '#ffffff',
      cardBorderColor: '#ffffff',
      cardOpacity: 0.48,
      cardFontWeight: 700
    }
  }

  return {
    topbarBgColor: normalizeColor(value?.topbarBgColor, defaultSettings.appearance.topbarBgColor),
    topbarTextColor: normalizeColor(value?.topbarTextColor, defaultSettings.appearance.topbarTextColor),
    topbarBorderColor: normalizeColor(value?.topbarBorderColor, defaultSettings.appearance.topbarBorderColor),
    topbarOpacity: normalizeOpacity(value?.topbarOpacity, defaultSettings.appearance.topbarOpacity),
    topbarFontWeight: normalizeFontWeight(value?.topbarFontWeight, defaultSettings.appearance.topbarFontWeight),
    menuBgColor: normalizeColor(value?.menuBgColor, defaultSettings.appearance.menuBgColor),
    menuActiveBgColor: normalizeColor(value?.menuActiveBgColor, defaultSettings.appearance.menuActiveBgColor),
    menuTextColor: normalizeColor(value?.menuTextColor, defaultSettings.appearance.menuTextColor),
    menuBorderColor: normalizeColor(value?.menuBorderColor, defaultSettings.appearance.menuBorderColor),
    menuOpacity: normalizeOpacity(value?.menuOpacity, defaultSettings.appearance.menuOpacity),
    menuFontWeight: normalizeFontWeight(value?.menuFontWeight, defaultSettings.appearance.menuFontWeight),
    cardBgColor: normalizeColor(value?.cardBgColor, defaultSettings.appearance.cardBgColor),
    cardTextColor: normalizeColor(value?.cardTextColor, defaultSettings.appearance.cardTextColor),
    cardBorderColor: normalizeColor(value?.cardBorderColor, defaultSettings.appearance.cardBorderColor),
    cardOpacity: normalizeOpacity(value?.cardOpacity, defaultSettings.appearance.cardOpacity),
    cardFontWeight: normalizeFontWeight(value?.cardFontWeight, defaultSettings.appearance.cardFontWeight)
  }
}

function normalizePreset(value: any, index: number): SettingsPreset | null {
  if (!value?.name || typeof value.name !== 'string') return null

  return {
    id: typeof value.id === 'string' && value.id ? value.id : `preset-${index}`,
    name: value.name.trim(),
    siteTitle: normalizeSiteTitle(value.siteTitle),
    siteLogo: normalizeSiteLogo(value.siteLogo),
    theme: normalizeTheme(value.theme),
    background: normalizeBackground(value.background),
    appearance: normalizeAppearance(value.appearance),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString()
  }
}

function normalizePresets(value: any): SettingsPreset[] {
  if (!Array.isArray(value)) return []

  return value
    .map((preset, index) => normalizePreset(preset, index))
    .filter((preset): preset is SettingsPreset => Boolean(preset))
}

export async function getSites(db: D1Database, category?: string, includePrivate = false) {
  await ensurePrivateCategory(db)
  let query = 'SELECT * FROM sites'
  const params: string[] = []
  const conditions: string[] = []

  if (category) {
    conditions.push('category = ?')
    params.push(category)
  }

  if (!includePrivate) {
    conditions.push('(category IS NULL OR category != ?)')
    params.push(PRIVATE_CATEGORY_NAME)
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`
  }

  query += ' ORDER BY sort DESC, id ASC'

  const { results } = await db.prepare(query).bind(...params).all()
  return results as unknown as Site[]
}

export async function getSiteById(db: D1Database, id: number) {
  const result = await db.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first()
  return result as unknown as Site | null
}

export async function createSite(db: D1Database, data: Site) {
  await ensurePrivateCategory(db)
  const { name, url, icon, category, description, sort } = data
  const result = await db.prepare(
    'INSERT INTO sites (name, url, icon, category, description, sort) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(name, url, icon || null, category || 'other', description || null, sort || 0).first()
  return result as unknown as Site
}

export async function updateSite(db: D1Database, id: number, data: Partial<Site>) {
  await ensurePrivateCategory(db)
  const fields: string[] = []
  const values: any[] = []

  if (data.name !== undefined) {
    fields.push('name = ?')
    values.push(data.name)
  }
  if (data.url !== undefined) {
    fields.push('url = ?')
    values.push(data.url)
  }
  if (data.icon !== undefined) {
    fields.push('icon = ?')
    values.push(data.icon)
  }
  if (data.category !== undefined) {
    fields.push('category = ?')
    values.push(data.category)
  }
  if (data.description !== undefined) {
    fields.push('description = ?')
    values.push(data.description)
  }
  if (data.sort !== undefined) {
    fields.push('sort = ?')
    values.push(data.sort)
  }

  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)

  const query = `UPDATE sites SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  const result = await db.prepare(query).bind(...values).first()
  return result as unknown as Site | null
}

export async function deleteSite(db: D1Database, id: number) {
  await db.prepare('DELETE FROM sites WHERE id = ?').bind(id).run()
  return true
}

export async function getSubmissions(db: D1Database, status = 'pending') {
  await ensureSubmissionsTable(db)
  const { results } = await db.prepare(
    'SELECT * FROM site_submissions WHERE status = ? ORDER BY created_at DESC, id DESC'
  ).bind(status).all()
  return results as unknown as SiteSubmission[]
}

export async function getSubmissionById(db: D1Database, id: number) {
  await ensureSubmissionsTable(db)
  const result = await db.prepare('SELECT * FROM site_submissions WHERE id = ?').bind(id).first()
  return result as unknown as SiteSubmission | null
}

export async function createSubmission(db: D1Database, data: SiteSubmission) {
  await ensureSubmissionsTable(db)
  const { name, url, icon, category, description, email } = data
  const result = await db.prepare(
    'INSERT INTO site_submissions (name, url, icon, category, description, email, status) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(name, url, icon || null, category || '其他', description || null, email, 'pending').first()
  return result as unknown as SiteSubmission
}

export async function updateSubmissionStatus(db: D1Database, id: number, status: SiteSubmission['status'], reviewNote?: string) {
  await ensureSubmissionsTable(db)
  const result = await db.prepare(
    'UPDATE site_submissions SET status = ?, review_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *'
  ).bind(status, reviewNote || null, id).first()
  return result as unknown as SiteSubmission | null
}

export async function getShortcuts(db: D1Database, includePrivate = false) {
  await ensureShortcutsTable(db)
  const query = includePrivate
    ? 'SELECT shortcuts.* FROM shortcuts LEFT JOIN sites ON sites.id = shortcuts.site_id ORDER BY shortcuts.sort DESC, shortcuts.id ASC'
    : 'SELECT shortcuts.* FROM shortcuts LEFT JOIN sites ON sites.id = shortcuts.site_id WHERE sites.category IS NULL OR sites.category != ? ORDER BY shortcuts.sort DESC, shortcuts.id ASC'
  const statement = db.prepare(query)
  const { results } = includePrivate
    ? await statement.all()
    : await statement.bind(PRIVATE_CATEGORY_NAME).all()
  return results as unknown as Shortcut[]
}

export async function getShortcutById(db: D1Database, id: number) {
  await ensureShortcutsTable(db)
  const result = await db.prepare('SELECT * FROM shortcuts WHERE id = ?').bind(id).first()
  return result as unknown as Shortcut | null
}

export async function getShortcutByUrl(db: D1Database, url: string) {
  await ensureShortcutsTable(db)
  const result = await db.prepare('SELECT * FROM shortcuts WHERE url = ?').bind(url).first()
  return result as unknown as Shortcut | null
}

export async function createShortcut(db: D1Database, data: Shortcut) {
  await ensureShortcutsTable(db)
  const existing = await getShortcutByUrl(db, data.url)
  if (existing) return existing

  const { site_id, name, url, icon, sort } = data
  const result = await db.prepare(
    'INSERT INTO shortcuts (site_id, name, url, icon, sort) VALUES (?, ?, ?, ?, ?) RETURNING *'
  ).bind(site_id || null, name, url, icon || null, sort || 0).first()
  return result as unknown as Shortcut
}

export async function updateShortcut(db: D1Database, id: number, data: Partial<Shortcut>) {
  await ensureShortcutsTable(db)
  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) {
    fields.push('name = ?')
    values.push(data.name)
  }

  if (data.url !== undefined) {
    fields.push('url = ?')
    values.push(data.url)
  }

  if (data.icon !== undefined) {
    fields.push('icon = ?')
    values.push(data.icon || null)
  }

  if (data.sort !== undefined) {
    fields.push('sort = ?')
    values.push(data.sort)
  }

  if (fields.length === 0) {
    return getShortcutById(db, id)
  }

  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)

  const result = await db.prepare(
    `UPDATE shortcuts SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...values).first()

  return result as unknown as Shortcut | null
}

export async function deleteShortcut(db: D1Database, id: number) {
  await ensureShortcutsTable(db)
  await db.prepare('DELETE FROM shortcuts WHERE id = ?').bind(id).run()
  return true
}

export async function getSettings(db: D1Database): Promise<Settings> {
  const { results } = await db.prepare('SELECT key, value FROM settings').all()

  const settings: any = {
    ...defaultSettings
  }

  for (const row of results as any[]) {
    try {
      settings[row.key] = JSON.parse(row.value)
    } catch {
      settings[row.key] = row.value
    }
  }

  return {
    siteTitle: normalizeSiteTitle(settings.siteTitle),
    siteLogo: normalizeSiteLogo(settings.siteLogo),
    theme: normalizeTheme(settings.theme),
    background: normalizeBackground(settings.background),
    appearance: normalizeAppearance(settings.appearance),
    presets: normalizePresets(settings.presets)
  }
}

export async function updateSetting(db: D1Database, key: string, value: any) {
  const jsonValue = JSON.stringify(value)
  await db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP'
  ).bind(key, jsonValue, jsonValue).run()
  return true
}

// 分类管理
export async function getCategories(db: D1Database, includePrivate = false) {
  await ensurePrivateCategory(db)
  const query = includePrivate
    ? 'SELECT * FROM categories ORDER BY sort DESC, name ASC'
    : 'SELECT * FROM categories WHERE name != ? ORDER BY sort DESC, name ASC'
  const statement = db.prepare(query)
  const { results } = includePrivate
    ? await statement.all()
    : await statement.bind(PRIVATE_CATEGORY_NAME).all()
  return results as unknown as Array<{ id: number; name: string; sort: number }>
}

export async function createCategory(db: D1Database, name: string) {
  await ensurePrivateCategory(db)
  const result = await db.prepare(
    'INSERT INTO categories (name, sort) VALUES (?, 0) RETURNING *'
  ).bind(name).first()
  return result as unknown as { id: number; name: string; sort: number }
}

export async function deleteCategory(db: D1Database, id: number) {
  await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run()
  return true
}
