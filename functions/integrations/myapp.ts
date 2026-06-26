type MyAppRecordType = 'NOTE' | 'ACCOUNT' | 'CODE_ACCOUNT'
type MyAppAccountSource = 'CODE_ACCOUNT' | 'PERSONAL_ACCOUNT' | 'ACCOUNT'
type LocalAccountKind = 'normal' | 'gpt'

interface MyAppExportItem {
  type: MyAppRecordType
  sourceId: string
  fields: Record<string, unknown>
  createTime?: string | null
  updateTime?: string | null
}

interface MyAppExportPayload {
  schemaVersion?: number
  exportedAt?: string
  notes?: MyAppExportItem[]
  accounts?: MyAppExportItem[]
  codeAccounts?: MyAppExportItem[]
}

interface MyAppWrappedEncryptedResponse {
  code?: number
  success: boolean
  message?: string
  data?: {
    algorithm?: string
    encryptedPayload?: string
  }
  error?: string
}

interface SyncedRecordSource {
  system: 'myapp'
  type: 'NOTE' | 'ACCOUNT' | 'CODE_ACCOUNT' | 'PERSONAL_ACCOUNT'
  id: string
}

interface SyncedAccountRecord {
  type: 'account'
  accountKind: LocalAccountKind
  source: SyncedRecordSource
  title: string
  username: string
  password: string
  url: string
  note: string
  category?: string
  status?: string
}

interface SyncedNoteRecord {
  type: 'note'
  source: SyncedRecordSource
  description: string
  detail: string
  summary?: string
  contentFormat?: string
  importance?: string
  privateNote?: boolean
}

interface LocalRecordSource {
  system?: string
  type?: string
  id?: string
}

interface LocalBaseRecord {
  id?: number
  source?: LocalRecordSource
  created_at?: string
  updated_at?: string
}

interface LocalAccountRecord extends LocalBaseRecord {
  type: 'account'
  accountKind?: LocalAccountKind
  title?: string
  username?: string
  password?: string
  url?: string
  note?: string
  category?: string
  status?: string
}

interface LocalNoteRecord extends LocalBaseRecord {
  type: 'note'
  description?: string
  detail?: string
  summary?: string
  contentFormat?: string
  importance?: string
  privateNote?: boolean
}

type LocalVaultRecord = LocalAccountRecord | LocalNoteRecord

export type MyAppSyncedRecord = SyncedAccountRecord | SyncedNoteRecord

export interface MyAppPassiveChange {
  action: 'CREATE' | 'UPDATE' | 'CONFLICT' | 'UNSUPPORTED' | string
  type: 'NOTE' | 'ACCOUNT' | string
  sourceId: string
  matchReason?: string
  changedFields?: string[]
  incoming?: unknown
  current?: unknown
  message?: string
  error?: string
}

export interface MyAppPassiveResult {
  schemaVersion?: number
  comparedAt?: string
  uploadSchemaVersion?: number
  summary?: Record<string, number>
  notes?: MyAppPassiveChange[]
  accounts?: MyAppPassiveChange[]
  changes: MyAppPassiveChange[]
}

const DEFAULT_PAYLOAD_KEY_PREFIX = 'myapp-export-payload-v1:'
const DEFAULT_SYNC_SOURCE = 'navigation'
const GCM_NONCE_LENGTH = 12

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function normalizeBaseUrl(value: unknown) {
  if (typeof value !== 'string') return ''

  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

function normalizeExportKey(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePayloadKeyPrefix(value: unknown) {
  return typeof value === 'string' && value ? value : DEFAULT_PAYLOAD_KEY_PREFIX
}

function normalizeSyncSource(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || DEFAULT_SYNC_SOURCE
}

function toMyAppLocalDateTime(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 19)
  }

  const trimmed = textValue(value)
  if (!trimmed) return null

  const withoutTimezone = trimmed
    .replace(' ', 'T')
    .replace(/Z$/i, '')
    .replace(/[+-]\d{2}:?\d{2}$/, '')
  const matched = withoutTimezone.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/)
  if (matched) {
    return `${matched[1]}T${matched[2]}`
  }

  const parsed = Date.parse(trimmed)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString().slice(0, 19)
}

async function sha256Bytes(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}

async function importPayloadKey(exportKey: string, payloadKeyPrefix: string) {
  const keyBytes = await sha256Bytes(`${payloadKeyPrefix}${exportKey}`)
  return crypto.subtle.importKey(
    'raw',
    bytesToArrayBuffer(keyBytes),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptPayload(payload: unknown, exportKey: string, payloadKeyPrefix: string) {
  const iv = new Uint8Array(GCM_NONCE_LENGTH)
  crypto.getRandomValues(iv)
  const key = await importPayloadKey(exportKey, payloadKeyPrefix)
  const ciphertextWithTag = new Uint8Array(await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: bytesToArrayBuffer(iv),
      tagLength: 128
    },
    key,
    bytesToArrayBuffer(encoder.encode(JSON.stringify(payload)))
  ))
  const encrypted = new Uint8Array(iv.byteLength + ciphertextWithTag.byteLength)
  encrypted.set(iv, 0)
  encrypted.set(ciphertextWithTag, iv.byteLength)

  return {
    algorithm: 'AES-256-GCM',
    encryptedPayload: bytesToBase64(encrypted)
  }
}

async function decryptPayload<T>(encryptedPayload: string, exportKey: string, payloadKeyPrefix: string): Promise<T> {
  const encrypted = base64ToBytes(encryptedPayload)
  if (encrypted.byteLength <= GCM_NONCE_LENGTH + 16) {
    throw new Error('MyApp 返回的加密数据无效')
  }

  const iv = encrypted.slice(0, GCM_NONCE_LENGTH)
  const ciphertextWithTag = encrypted.slice(GCM_NONCE_LENGTH)
  const key = await importPayloadKey(exportKey, payloadKeyPrefix)

  const plainBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: bytesToArrayBuffer(iv),
      tagLength: 128
    },
    key,
    bytesToArrayBuffer(ciphertextWithTag)
  )

  return JSON.parse(decoder.decode(plainBuffer)) as T
}

function assertMyAppConfig(baseUrlInput: unknown, exportKeyInput: unknown) {
  const baseUrl = normalizeBaseUrl(baseUrlInput)
  const exportKey = normalizeExportKey(exportKeyInput)

  if (!baseUrl) {
    throw new Error('MyApp 地址无效')
  }

  if (!exportKey) {
    throw new Error('导出 Key 不能为空')
  }

  return { baseUrl, exportKey }
}

async function readWrappedEncryptedResponse(response: Response, fallbackError: string) {
  const result = await response.json() as MyAppWrappedEncryptedResponse
  if (!response.ok || result.code !== 0 || !result.success || !result.data?.encryptedPayload) {
    throw new Error(result.error || result.message || fallbackError)
  }

  if (result.data.algorithm && result.data.algorithm !== 'AES-256-GCM') {
    throw new Error(`不支持的 MyApp 加密算法: ${result.data.algorithm}`)
  }

  return result.data.encryptedPayload
}

function accountSourceType(value: string): SyncedRecordSource['type'] {
  if (value === 'CODE_ACCOUNT') return 'CODE_ACCOUNT'
  if (value === 'PERSONAL_ACCOUNT') return 'PERSONAL_ACCOUNT'
  return 'ACCOUNT'
}

function accountSourceLabel(value: SyncedRecordSource['type']) {
  if (value === 'CODE_ACCOUNT') return 'Code 账号'
  if (value === 'PERSONAL_ACCOUNT') return '个人账户'
  return '账户'
}

function legacySourceIdVariants(sourceId: string, sourceType: SyncedRecordSource['type']) {
  const variants = new Set([sourceId])
  if (sourceId.startsWith('CODE_ACCOUNT:')) {
    variants.add(sourceId.slice('CODE_ACCOUNT:'.length))
  }
  if (sourceId.startsWith('PERSONAL_ACCOUNT:')) {
    variants.add(sourceId.slice('PERSONAL_ACCOUNT:'.length))
  }

  const hasKnownAccountPrefix = sourceId.startsWith('CODE_ACCOUNT:') || sourceId.startsWith('PERSONAL_ACCOUNT:')
  if (sourceType === 'CODE_ACCOUNT' && !hasKnownAccountPrefix) {
    variants.add(`CODE_ACCOUNT:${sourceId}`)
  }

  if ((sourceType === 'PERSONAL_ACCOUNT' || sourceType === 'ACCOUNT') && !hasKnownAccountPrefix) {
    variants.add(`PERSONAL_ACCOUNT:${sourceId}`)
  }

  return Array.from(variants)
}

function mapNote(item: MyAppExportItem): SyncedNoteRecord {
  const title = stringValue(item.fields.title)
  const summary = stringValue(item.fields.summary)
  const content = stringValue(item.fields.content)
  const contentFormat = stringValue(item.fields.contentFormat)
  const importance = stringValue(item.fields.importance)

  return {
    type: 'note',
    source: {
      system: 'myapp',
      type: 'NOTE',
      id: item.sourceId
    },
    description: title,
    detail: content,
    summary,
    contentFormat: contentFormat || undefined,
    importance: importance || undefined,
    privateNote: typeof item.fields.privateNote === 'boolean' ? item.fields.privateNote : undefined
  }
}

function mapCodeAccount(item: MyAppExportItem): SyncedAccountRecord {
  const account = textValue(item.fields.account)
  const status = textValue(item.fields.status) || 'ACTIVE'

  return {
    type: 'account',
    accountKind: 'gpt',
    source: {
      system: 'myapp',
      type: 'CODE_ACCOUNT',
      id: item.sourceId
    },
    title: account || `MyApp Code 账号 ${item.sourceId}`,
    username: account,
    password: textValue(item.fields.password),
    url: '',
    note: '来源：MyApp Code 账号',
    status
  }
}

function mapAccount(item: MyAppExportItem): SyncedAccountRecord {
  const account = textValue(item.fields.account)
  const accountSource = textValue(item.fields.accountSource).toUpperCase()
  const accountType = textValue(item.fields.accountType) || '其他'
  const loginUrl = textValue(item.fields.loginUrl)
  const sourceType = accountSourceType(accountSource)
  const sourceLabel = accountSourceLabel(sourceType)
  const accountKind: LocalAccountKind = sourceType === 'CODE_ACCOUNT' ? 'gpt' : 'normal'
  const status = accountKind === 'gpt' ? textValue(item.fields.status) || 'ACTIVE' : undefined

  return {
    type: 'account',
    accountKind,
    source: {
      system: 'myapp',
      type: sourceType,
      id: item.sourceId
    },
    title: account || `MyApp ${sourceLabel} ${item.sourceId}`,
    username: account,
    password: textValue(item.fields.password),
    url: loginUrl,
    note: `来源：MyApp ${sourceLabel}${accountType ? ` / ${accountType}` : ''}`,
    category: accountKind === 'normal' ? (accountType || '其他') : undefined,
    status
  }
}

function mapPayload(payload: MyAppExportPayload) {
  const notes = Array.isArray(payload.notes) ? payload.notes : []
  const accounts = Array.isArray(payload.accounts) ? payload.accounts : []
  const legacyCodeAccounts = accounts.length === 0 && Array.isArray(payload.codeAccounts)
    ? payload.codeAccounts
    : []

  return [
    ...notes.map(mapNote),
    ...accounts.map(mapAccount),
    ...legacyCodeAccounts.map(mapCodeAccount)
  ]
}

function sourceLookupKeys(source: LocalRecordSource | SyncedRecordSource | undefined, recordType: 'account' | 'note') {
  if (source?.system !== 'myapp' || !source.type || !source.id) return []

  if (recordType === 'note') {
    return [`NOTE|${source.id}`]
  }

  return legacySourceIdVariants(source.id, source.type as SyncedRecordSource['type'])
    .map((sourceId) => `ACCOUNT|${sourceId}`)
}

function buildCurrentMyAppRecordMap(records: MyAppSyncedRecord[]) {
  const recordMap = new Map<string, MyAppSyncedRecord>()

  records.forEach((record) => {
    sourceLookupKeys(record.source, record.type).forEach((key) => {
      recordMap.set(key, record)
    })
  })

  return recordMap
}

function findCurrentMyAppRecord(record: LocalVaultRecord, recordMap: Map<string, MyAppSyncedRecord>) {
  for (const key of sourceLookupKeys(record.source, record.type)) {
    const currentRecord = recordMap.get(key)
    if (currentRecord) return currentRecord
  }

  return null
}

function hydrateLocalRecordsWithMyAppMetadata(recordsInput: unknown, currentRecords: MyAppSyncedRecord[]) {
  const recordMap = buildCurrentMyAppRecordMap(currentRecords)

  return normalizeLocalRecords(recordsInput).map((record) => {
    const currentRecord = findCurrentMyAppRecord(record, recordMap)
    if (!currentRecord || currentRecord.type !== record.type) return record

    if (record.type === 'note' && currentRecord.type === 'note') {
      return {
        ...record,
        summary: currentRecord.summary,
        contentFormat: currentRecord.contentFormat,
        importance: currentRecord.importance,
        privateNote: currentRecord.privateNote
      }
    }

    if (record.type === 'account' && currentRecord.type === 'account') {
      return {
        ...record,
        status: currentRecord.accountKind === 'gpt' ? currentRecord.status : undefined
      }
    }

    return record
  })
}

function normalizeLocalRecords(value: unknown): LocalVaultRecord[] {
  if (!Array.isArray(value)) return []

  return value.filter((item): item is LocalVaultRecord => (
    Boolean(item)
    && typeof item === 'object'
    && ((item as Record<string, unknown>).type === 'account' || (item as Record<string, unknown>).type === 'note')
  ))
}

function getLocalSourceId(record: LocalVaultRecord, fallback: string) {
  if (record.source?.system === 'myapp' && record.source.id) {
    const sourceId = record.source.id
    const hasKnownAccountPrefix = sourceId.startsWith('CODE_ACCOUNT:') || sourceId.startsWith('PERSONAL_ACCOUNT:')
    if (record.type === 'account' && !hasKnownAccountPrefix) {
      const accountSource = getLocalAccountSource(record)
      return accountSource === 'CODE_ACCOUNT' ? `CODE_ACCOUNT:${sourceId}` : `PERSONAL_ACCOUNT:${sourceId}`
    }
    return sourceId
  }
  return fallback
}

function getLocalAccountSource(record: LocalAccountRecord): MyAppAccountSource {
  if (record.accountKind === 'gpt') return 'CODE_ACCOUNT'
  if (record.source?.system !== 'myapp') return 'PERSONAL_ACCOUNT'
  if (record.source.type === 'CODE_ACCOUNT' || record.source.id?.startsWith('CODE_ACCOUNT:')) return 'CODE_ACCOUNT'
  return 'PERSONAL_ACCOUNT'
}

function toMyAppAccount(record: LocalAccountRecord, index: number): MyAppExportItem {
  const accountSource = getLocalAccountSource(record)
  const accountType = accountSource === 'CODE_ACCOUNT' ? 'GPT' : textValue(record.category) || '其他'
  const sourceId = getLocalSourceId(record, `NAV_ACCOUNT:${record.id || index + 1}`)
  const loginUrl = typeof record.url === 'string' && record.url ? record.url : null
  const fields: Record<string, unknown> = {
    accountSource,
    accountType,
    account: textValue(record.username || record.title),
    password: typeof record.password === 'string' ? record.password : ''
  }

  if (accountSource === 'CODE_ACCOUNT') {
    fields.status = textValue(record.status) || 'ACTIVE'
  } else {
    fields.loginUrl = loginUrl
  }

  return {
    type: 'ACCOUNT',
    sourceId,
    fields,
    createTime: toMyAppLocalDateTime(record.created_at),
    updateTime: toMyAppLocalDateTime(record.updated_at)
  }
}

function toMyAppNote(record: LocalNoteRecord, index: number): MyAppExportItem {
  const detail = stringValue(record.detail)
  const sourceId = getLocalSourceId(record, `NAV_NOTE:${record.id || index + 1}`)
  const hasSummary = typeof record.summary === 'string'
  const sourceFromMyApp = record.source?.system === 'myapp'
  const title = sourceFromMyApp
    ? stringValue(record.description)
    : stringValue(record.description) || `随身记录 ${record.id || index + 1}`
  const summary = hasSummary ? record.summary! : (sourceFromMyApp ? '' : detail.slice(0, 120))
  const contentFormat = stringValue(record.contentFormat) || 'TEXT'
  const importance = stringValue(record.importance) || 'NORMAL'
  const privateNote = typeof record.privateNote === 'boolean' ? record.privateNote : true

  return {
    type: 'NOTE',
    sourceId,
    fields: {
      title,
      summary,
      content: detail,
      contentFormat,
      importance,
      privateNote
    },
    createTime: toMyAppLocalDateTime(record.created_at),
    updateTime: toMyAppLocalDateTime(record.updated_at)
  }
}

function buildPassiveUploadPayload(recordsInput: unknown): MyAppExportPayload {
  const records = normalizeLocalRecords(recordsInput)
  const notes: MyAppExportItem[] = []
  const accounts: MyAppExportItem[] = []

  records.forEach((record, index) => {
    if (record.type === 'account') {
      accounts.push(toMyAppAccount(record, index))
    } else {
      notes.push(toMyAppNote(record, index))
    }
  })

  return {
    schemaVersion: 4,
    exportedAt: toMyAppLocalDateTime(new Date()) || undefined,
    notes,
    accounts
  }
}

function normalizePassiveResult(value: unknown): MyAppPassiveResult {
  const record = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const notes = Array.isArray(record.notes) ? record.notes as MyAppPassiveChange[] : []
  const accounts = Array.isArray(record.accounts) ? record.accounts as MyAppPassiveChange[] : []
  const changes = Array.isArray(record.changes)
    ? record.changes as MyAppPassiveChange[]
    : [...notes, ...accounts]
  const summary = record.summary && typeof record.summary === 'object'
    ? record.summary as Record<string, number>
    : {}

  return {
    schemaVersion: typeof record.schemaVersion === 'number' ? record.schemaVersion : undefined,
    comparedAt: textValue(record.comparedAt) || undefined,
    uploadSchemaVersion: typeof record.uploadSchemaVersion === 'number' ? record.uploadSchemaVersion : undefined,
    summary,
    notes,
    accounts,
    changes
  }
}

export function getMyAppSourceIdVariants(source: { system?: string; type?: string; id?: string } | undefined) {
  if (source?.system !== 'myapp' || !source.type || !source.id) return []
  return legacySourceIdVariants(source.id, source.type as SyncedRecordSource['type'])
}

export async function syncMyAppExport(baseUrlInput: unknown, exportKeyInput: unknown, payloadKeyPrefixInput?: unknown) {
  const { baseUrl, exportKey } = assertMyAppConfig(baseUrlInput, exportKeyInput)
  const payloadKeyPrefix = normalizePayloadKeyPrefix(payloadKeyPrefixInput)

  const response = await fetch(`${baseUrl}/api/export/json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Export-Key': exportKey
    }
  })
  const encryptedPayload = await readWrappedEncryptedResponse(response, 'MyApp 导出失败')
  const payload = await decryptPayload<MyAppExportPayload>(encryptedPayload, exportKey, payloadKeyPrefix)
  const records = mapPayload(payload)

  return {
    schemaVersion: payload.schemaVersion || 1,
    exportedAt: payload.exportedAt || '',
    records,
    counts: {
      notes: Array.isArray(payload.notes) ? payload.notes.length : 0,
      accounts: Array.isArray(payload.accounts) ? payload.accounts.length : 0,
      records: records.length
    }
  }
}

export async function previewMyAppPassiveSync(
  records: unknown,
  baseUrlInput: unknown,
  exportKeyInput: unknown,
  payloadKeyPrefixInput?: unknown,
  syncSourceInput?: unknown
) {
  const { baseUrl, exportKey } = assertMyAppConfig(baseUrlInput, exportKeyInput)
  const payloadKeyPrefix = normalizePayloadKeyPrefix(payloadKeyPrefixInput)
  const syncSource = normalizeSyncSource(syncSourceInput)
  const currentExport = await syncMyAppExport(baseUrl, exportKey, payloadKeyPrefix)
  const hydratedRecords = hydrateLocalRecordsWithMyAppMetadata(records, currentExport.records)
  const uploadPayload = buildPassiveUploadPayload(hydratedRecords)
  const encryptedUpload = await encryptPayload(uploadPayload, exportKey, payloadKeyPrefix)

  const response = await fetch(`${baseUrl}/api/sync/passive/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Export-Key': exportKey,
      'X-Sync-Source': syncSource
    },
    body: JSON.stringify(encryptedUpload)
  })
  const encryptedPayload = await readWrappedEncryptedResponse(response, 'MyApp 被动同步预检失败')
  const preview = await decryptPayload<unknown>(encryptedPayload, exportKey, payloadKeyPrefix)

  return {
    upload: {
      schemaVersion: uploadPayload.schemaVersion,
      notes: uploadPayload.notes?.length || 0,
      accounts: uploadPayload.accounts?.length || 0
    },
    preview: normalizePassiveResult(preview)
  }
}

export async function confirmMyAppPassiveSync(
  changes: unknown,
  baseUrlInput: unknown,
  exportKeyInput: unknown,
  payloadKeyPrefixInput?: unknown,
  syncSourceInput?: unknown
) {
  const { baseUrl, exportKey } = assertMyAppConfig(baseUrlInput, exportKeyInput)
  const payloadKeyPrefix = normalizePayloadKeyPrefix(payloadKeyPrefixInput)
  const syncSource = normalizeSyncSource(syncSourceInput)
  const changeList = Array.isArray(changes) ? changes : []
  const encryptedUpload = await encryptPayload({ changes: changeList }, exportKey, payloadKeyPrefix)

  const response = await fetch(`${baseUrl}/api/sync/passive/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Export-Key': exportKey,
      'X-Sync-Source': syncSource
    },
    body: JSON.stringify(encryptedUpload)
  })
  const encryptedPayload = await readWrappedEncryptedResponse(response, 'MyApp 被动同步确认失败')
  const result = await decryptPayload<unknown>(encryptedPayload, exportKey, payloadKeyPrefix)

  return normalizePassiveResult(result)
}
