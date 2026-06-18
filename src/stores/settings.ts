import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useAuthStore } from './auth'

export type ThemeType = 'glass' | 'cyberpunk'

export interface BackgroundConfig {
  type: 'image' | 'particles'
  value: string
}

export interface AppearanceConfig {
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

export interface Settings {
  siteTitle: string
  siteLogo: string
  theme: ThemeType
  background: BackgroundConfig
  appearance: AppearanceConfig
  presets: SettingsPreset[]
}

export interface SettingsPreset {
  id: string
  name: string
  siteTitle: string
  siteLogo: string
  theme: ThemeType
  background: BackgroundConfig
  appearance: AppearanceConfig
  createdAt: string
}

interface RawBackgroundConfig {
  type?: string
  value?: string
}

interface SettingsResponse {
  success: boolean
  settings?: {
    siteTitle?: string
    siteLogo?: string
    theme?: string
    background?: RawBackgroundConfig
    appearance?: Partial<AppearanceConfig> & { mode?: string }
    presets?: RawSettingsPreset[]
  }
  error?: string
}

interface RawSettingsPreset {
  id?: string
  name?: string
  siteTitle?: string
  siteLogo?: string
  theme?: string
  background?: RawBackgroundConfig
  appearance?: Partial<AppearanceConfig> & { mode?: string }
  createdAt?: string
}

const defaultBackground: BackgroundConfig = {
  type: 'particles',
  value: 'default'
}

const legacyDefaultSiteTitle = '个人导航站'
const defaultSiteTitle = 'Nav'
const defaultSiteLogo = ''

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

const readableAppearance: AppearanceConfig = {
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

function normalizeTheme(value: string | undefined): ThemeType {
  return value === 'cyberpunk' ? 'cyberpunk' : 'glass'
}

function normalizeSiteTitle(value: unknown): string {
  if (typeof value !== 'string') return defaultSiteTitle

  const trimmed = value.trim()
  if (trimmed === legacyDefaultSiteTitle) return defaultSiteTitle
  if (!trimmed) return ''

  return trimmed
}

function normalizeSiteLogo(value: unknown): string {
  if (typeof value !== 'string') return defaultSiteLogo

  const trimmed = value.trim().slice(0, 500)
  if (!trimmed) return defaultSiteLogo
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  return defaultSiteLogo
}

function normalizeBackground(value: RawBackgroundConfig | undefined): BackgroundConfig {
  if (value?.type === 'image' && typeof value.value === 'string') {
    return {
      type: 'image',
      value: value.value
    }
  }

  return { ...defaultBackground }
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

function normalizeAppearance(value: (Partial<AppearanceConfig> & { mode?: string }) | undefined): AppearanceConfig {
  if (value?.mode === 'readable') {
    return { ...readableAppearance }
  }

  return {
    topbarBgColor: normalizeColor(value?.topbarBgColor, defaultAppearance.topbarBgColor),
    topbarTextColor: normalizeColor(value?.topbarTextColor, defaultAppearance.topbarTextColor),
    topbarBorderColor: normalizeColor(value?.topbarBorderColor, defaultAppearance.topbarBorderColor),
    topbarOpacity: normalizeOpacity(value?.topbarOpacity, defaultAppearance.topbarOpacity),
    topbarFontWeight: normalizeFontWeight(value?.topbarFontWeight, defaultAppearance.topbarFontWeight),
    menuBgColor: normalizeColor(value?.menuBgColor, defaultAppearance.menuBgColor),
    menuActiveBgColor: normalizeColor(value?.menuActiveBgColor, defaultAppearance.menuActiveBgColor),
    menuTextColor: normalizeColor(value?.menuTextColor, defaultAppearance.menuTextColor),
    menuBorderColor: normalizeColor(value?.menuBorderColor, defaultAppearance.menuBorderColor),
    menuOpacity: normalizeOpacity(value?.menuOpacity, defaultAppearance.menuOpacity),
    menuFontWeight: normalizeFontWeight(value?.menuFontWeight, defaultAppearance.menuFontWeight),
    cardBgColor: normalizeColor(value?.cardBgColor, defaultAppearance.cardBgColor),
    cardTextColor: normalizeColor(value?.cardTextColor, defaultAppearance.cardTextColor),
    cardBorderColor: normalizeColor(value?.cardBorderColor, defaultAppearance.cardBorderColor),
    cardOpacity: normalizeOpacity(value?.cardOpacity, defaultAppearance.cardOpacity),
    cardFontWeight: normalizeFontWeight(value?.cardFontWeight, defaultAppearance.cardFontWeight)
  }
}

function copyAppearance(value: AppearanceConfig): AppearanceConfig {
  return { ...value }
}

function copyBackground(value: BackgroundConfig): BackgroundConfig {
  return { ...value }
}

function normalizePreset(value: RawSettingsPreset | undefined, index: number): SettingsPreset | null {
  if (!value?.name?.trim()) return null

  return {
    id: value.id || `preset-${index}`,
    name: value.name.trim(),
    siteTitle: normalizeSiteTitle(value.siteTitle),
    siteLogo: normalizeSiteLogo(value.siteLogo),
    theme: normalizeTheme(value.theme),
    background: normalizeBackground(value.background),
    appearance: normalizeAppearance(value.appearance),
    createdAt: value.createdAt || new Date(0).toISOString()
  }
}

function normalizePresets(value: RawSettingsPreset[] | undefined): SettingsPreset[] {
  if (!Array.isArray(value)) return []

  return value
    .map((preset, index) => normalizePreset(preset, index))
    .filter((preset): preset is SettingsPreset => Boolean(preset))
}

function createPresetId() {
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const useSettingsStore = defineStore('settings', () => {
  const siteTitle = ref<string>(defaultSiteTitle)
  const siteLogo = ref<string>(defaultSiteLogo)
  const theme = ref<ThemeType>('glass')
  const background = ref<BackgroundConfig>({ ...defaultBackground })
  const appearance = ref<AppearanceConfig>({ ...defaultAppearance })
  const presets = ref<SettingsPreset[]>([])
  const loading = ref<boolean>(false)

  // 获取设置
  async function fetchSettings() {
    loading.value = true

    try {
      const response = await fetch('/api/settings')
      const data = await response.json() as SettingsResponse

      if (data.success && data.settings) {
        siteTitle.value = normalizeSiteTitle(data.settings.siteTitle)
        siteLogo.value = normalizeSiteLogo(data.settings.siteLogo)
        theme.value = normalizeTheme(data.settings.theme)
        background.value = normalizeBackground(data.settings.background)
        appearance.value = normalizeAppearance(data.settings.appearance)
        presets.value = normalizePresets(data.settings.presets)
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      loading.value = false
    }
  }

  // 保存设置到后端
  async function saveSettings(): Promise<boolean> {
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          siteTitle: siteTitle.value,
          siteLogo: siteLogo.value,
          theme: theme.value,
          background: background.value,
          appearance: appearance.value,
          presets: presets.value
        })
      })

      const data = await response.json() as SettingsResponse
      return data.success
    } catch (error) {
      console.error('Failed to save settings:', error)
      return false
    }
  }

  // 更新主题
  function updateSiteTitle(newTitle: string) {
    siteTitle.value = newTitle
  }

  function updateSiteLogo(newLogo: string) {
    siteLogo.value = newLogo.trim().slice(0, 500)
  }

  // 更新主题
  function updateTheme(newTheme: ThemeType) {
    theme.value = newTheme
  }

  // 更新背景
  function updateBackground(newBackground: BackgroundConfig) {
    background.value = newBackground
  }

  // 应用系统硬编码初始值
  function initializeSettings() {
    siteTitle.value = defaultSiteTitle
    siteLogo.value = defaultSiteLogo
    theme.value = 'glass'
    background.value = { ...defaultBackground }
    appearance.value = copyAppearance(defaultAppearance)
  }

  // 新增或更新预设：同名预设会被当前配置覆盖
  function createPreset(name: string): boolean {
    const normalizedName = name.trim()
    if (!normalizedName) return false

    const preset: SettingsPreset = {
      id: createPresetId(),
      name: normalizedName,
      siteTitle: normalizeSiteTitle(siteTitle.value),
      siteLogo: normalizeSiteLogo(siteLogo.value),
      theme: theme.value,
      background: copyBackground(background.value),
      appearance: copyAppearance(appearance.value),
      createdAt: new Date().toISOString()
    }

    const existingIndex = presets.value.findIndex(item => item.name === normalizedName)
    if (existingIndex >= 0) {
      presets.value.splice(existingIndex, 1, {
        ...preset,
        id: presets.value[existingIndex].id
      })
    } else {
      presets.value.unshift(preset)
    }

    return true
  }

  function applyPreset(id: string): boolean {
    const preset = presets.value.find(item => item.id === id)
    if (!preset) return false

    siteTitle.value = preset.siteTitle
    siteLogo.value = normalizeSiteLogo(preset.siteLogo)
    theme.value = preset.theme
    background.value = copyBackground(preset.background)
    appearance.value = copyAppearance(preset.appearance)
    return true
  }

  // 更新界面细节
  function updateAppearance(newAppearance: Partial<AppearanceConfig>) {
    appearance.value = normalizeAppearance({
      ...appearance.value,
      ...newAppearance
    })
  }

  // 监听设置变化，自动保存（仅在已认证时）
  watch([siteTitle, siteLogo, theme, background, appearance, presets], () => {
    const authStore = useAuthStore()
    if (authStore.isAuthenticated) {
      saveSettings()
    }
  }, { deep: true })

  return {
    siteTitle,
    siteLogo,
    theme,
    background,
    appearance,
    presets,
    loading,
    fetchSettings,
    saveSettings,
    updateSiteTitle,
    updateSiteLogo,
    updateTheme,
    updateBackground,
    initializeSettings,
    createPreset,
    applyPreset,
    updateAppearance
  }
})
