import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type VaultRecordType = 'account' | 'note'
export type VaultAccountKind = 'normal' | 'gpt'
type VaultPayloadType = VaultRecordType | 'settings' | 'bill'

export interface VaultRecordSource {
  system: 'myapp' | string
  type: string
  id: string
}

interface VaultBaseRecord {
  id?: number
  type: VaultRecordType
  source?: VaultRecordSource
  created_at?: string
  updated_at?: string
}

export interface VaultAccountRecord extends VaultBaseRecord {
  type: 'account'
  accountKind: VaultAccountKind
  title: string
  username: string
  password: string
  url: string
  note: string
  category?: string
  status?: string
}

export interface VaultNoteRecord extends VaultBaseRecord {
  type: 'note'
  description: string
  detail: string
  summary?: string
  contentFormat?: string
  importance?: string
  privateNote?: boolean
}

interface DeprecatedVaultBillPayload {
  id?: number
  type: 'bill'
  created_at?: string
  updated_at?: string
}

type VaultDecryptedPayload = VaultRecord | VaultSettingsPayload | DeprecatedVaultBillPayload

export type VaultRecord = VaultAccountRecord | VaultNoteRecord
export type VaultItem = VaultAccountRecord

export interface VaultSettingsPayload {
  id?: number
  type: 'settings'
  visibleTabs: VaultRecordType[]
  accountCategories: string[]
  created_at?: string
  updated_at?: string
}

interface EncryptedVaultEntry {
  id?: number
  salt: string
  iv: string
  ciphertext: string
  created_at?: string
  updated_at?: string
}

interface VaultListResponse {
  success: boolean
  entries?: EncryptedVaultEntry[]
  error?: string
}

interface VaultEntryResponse {
  success: boolean
  entry?: EncryptedVaultEntry
  error?: string
}

const KDF_ITERATIONS = 160000
const UNLOCK_SESSION_TTL_MS = 10 * 60 * 1000
const ALL_TABS: VaultRecordType[] = ['account', 'note']
const encoder = new TextEncoder()
const decoder = new TextDecoder()
let unlockTimer: ReturnType<typeof setTimeout> | null = null

function bytesToBase64(bytes: Uint8Array) {
  // WebCrypto 返回的是二进制数据，存入 D1 前统一转成可 JSON 传输的 base64。
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

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // TypeScript 对 BufferSource 类型较严格，显式裁出 ArrayBuffer 可避免 SharedArrayBuffer 类型歧义。
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function getWebCrypto() {
  const cryptoApi = globalThis.crypto
  if (!cryptoApi?.subtle) {
    throw new Error('当前浏览器不支持安全加密')
  }
  return cryptoApi
}

async function deriveKey(masterPassword: string, salt: Uint8Array) {
  const cryptoApi = getWebCrypto()
  // 主密码不直接用于加密；先通过 PBKDF2 派生出 AES-GCM 需要的 256 位密钥。
  const baseKey = await cryptoApi.subtle.importKey(
    'raw',
    bytesToArrayBuffer(encoder.encode(masterPassword)),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: bytesToArrayBuffer(salt),
      iterations: KDF_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  )
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function optionalStringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function normalizeVisibleTabs(value: unknown): VaultRecordType[] {
  if (!Array.isArray(value)) return [...ALL_TABS]

  const nextTabs = ALL_TABS.filter((tab) => value.includes(tab))
  return nextTabs.length > 0 ? nextTabs : [...ALL_TABS]
}

function normalizeAccountCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => textValue(item))
    .filter((item) => item && item !== 'all')
    .filter((item, index, list) => list.indexOf(item) === index)
    .sort((left, right) => left.localeCompare(right, 'zh-CN'))
}

function normalizeSource(value: unknown): VaultRecordSource | undefined {
  if (!value || typeof value !== 'object') return undefined

  const record = value as Record<string, unknown>
  const system = textValue(record.system)
  const type = textValue(record.type)
  const id = textValue(record.id || record.sourceId)
  if (!system || !type || !id) return undefined

  return {
    system,
    type,
    id
  }
}

function sourceLooksLikeGptAccount(source: VaultRecordSource | undefined) {
  return source?.type === 'CODE_ACCOUNT' || Boolean(source?.id?.startsWith('CODE_ACCOUNT:'))
}

function normalizeAccountKind(record: Record<string, unknown>, source: VaultRecordSource | undefined): VaultAccountKind {
  const rawKind = textValue(record.accountKind || record.kind).toLowerCase()
  const rawSource = textValue(record.accountSource).toUpperCase()

  if (rawKind === 'gpt' || rawKind === 'code' || rawSource === 'CODE_ACCOUNT' || sourceLooksLikeGptAccount(source)) {
    return 'gpt'
  }

  return 'normal'
}

function normalizePayload(payload: unknown): VaultDecryptedPayload {
  const record = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  const type = record.type as VaultPayloadType | undefined
  const source = normalizeSource(record.source)

  if (type === 'settings') {
    return {
      type: 'settings',
      visibleTabs: normalizeVisibleTabs(record.visibleTabs),
      accountCategories: normalizeAccountCategories(record.accountCategories)
    }
  }

  if (type === 'note') {
    return {
      type: 'note',
      source,
      description: stringValue(record.description ?? record.title),
      detail: stringValue(record.detail ?? record.note),
      summary: optionalStringValue(record.summary),
      contentFormat: optionalStringValue(record.contentFormat),
      importance: optionalStringValue(record.importance),
      privateNote: typeof record.privateNote === 'boolean' ? record.privateNote : undefined
    }
  }

  if (type === 'bill') {
    return {
      type: 'bill'
    }
  }

  const accountKind = normalizeAccountKind(record, source)
  // 旧版单类型记录没有 type 字段，统一归并为账号类，保证原数据可继续解锁和编辑。
  return {
    type: 'account',
    accountKind,
    source,
    title: textValue(record.title || record.name),
    username: textValue(record.username || record.user || record.account),
    password: typeof record.password === 'string' ? record.password : '',
    url: textValue(record.url || record.website),
    note: textValue(record.note || record.description),
    category: accountKind === 'normal'
      ? textValue(record.category || record.accountType || record.typeName) || undefined
      : undefined,
    status: accountKind === 'gpt'
      ? textValue(record.status || record.accountStatus) || undefined
      : undefined
  }
}

function normalizeRecord(record: VaultRecord): VaultRecord {
  if (record.type === 'note') {
    return {
      id: record.id,
      type: 'note',
      source: record.source,
      description: record.description,
      detail: record.detail,
      summary: optionalStringValue(record.summary),
      contentFormat: optionalStringValue(record.contentFormat),
      importance: optionalStringValue(record.importance),
      privateNote: record.privateNote,
      created_at: record.created_at,
      updated_at: record.updated_at
    }
  }

  const accountKind = normalizeAccountKind(record as unknown as Record<string, unknown>, record.source)

  return {
    id: record.id,
    type: 'account',
    accountKind,
    source: record.source,
    title: record.title.trim(),
    username: record.username.trim(),
    password: record.password,
    url: record.url.trim(),
    note: record.note.trim(),
    category: accountKind === 'normal' ? record.category?.trim() || undefined : undefined,
    status: accountKind === 'gpt' ? record.status?.trim() || undefined : undefined,
    created_at: record.created_at,
    updated_at: record.updated_at
  }
}

function isVaultRecordPayload(payload: VaultDecryptedPayload): payload is VaultRecord {
  return payload.type === 'account' || payload.type === 'note'
}

function sourceIdVariants(source: VaultRecordSource | undefined) {
  if (source?.system !== 'myapp' || !source.id) return []

  const variants = new Set([source.id])
  if (source.id.startsWith('CODE_ACCOUNT:')) {
    variants.add(source.id.slice('CODE_ACCOUNT:'.length))
  }
  if (source.id.startsWith('PERSONAL_ACCOUNT:')) {
    variants.add(source.id.slice('PERSONAL_ACCOUNT:'.length))
  }
  const hasKnownAccountPrefix = source.id.startsWith('CODE_ACCOUNT:') || source.id.startsWith('PERSONAL_ACCOUNT:')
  if (source.type === 'CODE_ACCOUNT' && !hasKnownAccountPrefix) {
    variants.add(`CODE_ACCOUNT:${source.id}`)
  }
  if ((source.type === 'PERSONAL_ACCOUNT' || source.type === 'ACCOUNT') && !hasKnownAccountPrefix) {
    variants.add(`PERSONAL_ACCOUNT:${source.id}`)
  }

  return Array.from(variants)
}

function sourceTypesCompatible(left: VaultRecordSource, right: VaultRecordSource) {
  if (left.type === right.type) return true

  const accountTypes = ['ACCOUNT', 'CODE_ACCOUNT', 'PERSONAL_ACCOUNT']
  return accountTypes.includes(left.type)
    && accountTypes.includes(right.type)
    && (left.type === 'ACCOUNT' || right.type === 'ACCOUNT')
}

function sourcesMatch(left: VaultRecordSource | undefined, right: VaultRecordSource | undefined) {
  if (!left || !right) return false
  if (left.system !== right.system || !sourceTypesCompatible(left, right)) return false

  const leftIds = sourceIdVariants(left)
  const rightIds = sourceIdVariants(right)
  return leftIds.some((id) => rightIds.includes(id))
}

function normalizeSettings(settings: VaultSettingsPayload): VaultSettingsPayload {
  return {
    id: settings.id,
    type: 'settings',
    visibleTabs: normalizeVisibleTabs(settings.visibleTabs),
    accountCategories: normalizeAccountCategories(settings.accountCategories),
    created_at: settings.created_at,
    updated_at: settings.updated_at
  }
}

export const useVaultStore = defineStore('vault', () => {
  const encryptedEntries = ref<EncryptedVaultEntry[]>([])
  const records = ref<VaultRecord[]>([])
  const settingsEntryId = ref<number | null>(null)
  const visibleTabs = ref<VaultRecordType[]>([...ALL_TABS])
  const accountCategories = ref<string[]>([])
  const unlocked = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const masterPassword = ref('')

  const items = computed(() => records.value)
  const hasEntries = computed(() => encryptedEntries.value.length > 0)

  function clearUnlockTimer() {
    if (!unlockTimer) return
    clearTimeout(unlockTimer)
    unlockTimer = null
  }

  function refreshUnlockSession() {
    if (!unlocked.value || !masterPassword.value) return
    clearUnlockTimer()
    unlockTimer = setTimeout(() => {
      lock()
    }, UNLOCK_SESSION_TTL_MS)
  }

  async function fetchEntries(): Promise<boolean> {
    loading.value = true
    error.value = ''

    try {
      const response = await fetch('/api/vault', {
        credentials: 'same-origin'
      })
      const data = await response.json() as VaultListResponse

      if (!data.success) {
        error.value = data.error || '随身记录加载失败'
        return false
      }

      // 这里拿到的仍是密文，真正解密必须等用户输入主密码。
      encryptedEntries.value = data.entries || []
      return true
    } catch (err) {
      error.value = '网络错误'
      console.error('Failed to fetch records:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  async function encryptPayload(payload: VaultRecord | VaultSettingsPayload): Promise<EncryptedVaultEntry> {
    const cryptoApi = getWebCrypto()
    const salt = new Uint8Array(16)
    const iv = new Uint8Array(12)
    cryptoApi.getRandomValues(salt)
    cryptoApi.getRandomValues(iv)

    // 每条记录使用独立 salt 和 iv，即使内容相同，数据库里的密文也不同。
    const key = await deriveKey(masterPassword.value, salt)
    const normalizedPayload = payload.type === 'settings'
      ? normalizeSettings(payload)
      : normalizeRecord(payload)
    const ciphertext = await cryptoApi.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: bytesToArrayBuffer(iv)
      },
      key,
      bytesToArrayBuffer(encoder.encode(JSON.stringify(normalizedPayload)))
    )

    return {
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext))
    }
  }

  async function decryptEntry(entry: EncryptedVaultEntry, password: string): Promise<VaultDecryptedPayload> {
    const cryptoApi = getWebCrypto()
    const salt = base64ToBytes(entry.salt)
    const iv = base64ToBytes(entry.iv)
    const key = await deriveKey(password, salt)
    // AES-GCM 会同时做完整性校验；主密码错误或密文被改动都会解密失败。
    const decrypted = await cryptoApi.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: bytesToArrayBuffer(iv)
      },
      key,
      bytesToArrayBuffer(base64ToBytes(entry.ciphertext))
    )
    const payload = normalizePayload(JSON.parse(decoder.decode(decrypted)))

    return {
      ...payload,
      id: entry.id,
      created_at: entry.created_at,
      updated_at: entry.updated_at
    }
  }

  function applyDecryptedPayloads(payloads: VaultDecryptedPayload[]) {
    const nextRecords: VaultRecord[] = []
    let nextSettings: VaultSettingsPayload | null = null

    for (const payload of payloads) {
      if (payload.type === 'settings') {
        if (!nextSettings) {
          nextSettings = normalizeSettings(payload)
        }
      } else if (payload.type === 'bill') {
        continue
      } else {
        nextRecords.push(normalizeRecord(payload))
      }
    }

    records.value = nextRecords
    settingsEntryId.value = nextSettings?.id || null
    visibleTabs.value = nextSettings?.visibleTabs || [...ALL_TABS]
    accountCategories.value = nextSettings?.accountCategories || []
  }

  async function deleteEncryptedEntry(id: number): Promise<boolean> {
    try {
      const response = await fetch(`/api/vault/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      })
      const data = await response.json() as { success: boolean; error?: string }

      if (!data.success) {
        throw new Error(data.error || '删除失败')
      }

      encryptedEntries.value = encryptedEntries.value.filter((entry) => entry.id !== id)
      return true
    } catch (err) {
      console.error('Failed to delete deprecated bill record:', err)
      return false
    }
  }

  async function cleanupDeprecatedBillPayloads(payloads: VaultDecryptedPayload[]) {
    const ids = payloads
      .filter((payload): payload is DeprecatedVaultBillPayload & { id: number } => (
        payload.type === 'bill' && typeof payload.id === 'number'
      ))
      .map((payload) => payload.id)

    if (ids.length === 0) return

    await Promise.all(ids.map((id) => deleteEncryptedEntry(id)))
  }

  async function unlock(password: string): Promise<boolean> {
    const normalizedPassword = password.trim()
    if (!normalizedPassword) {
      error.value = '请输入主密码'
      return false
    }

    const loaded = await fetchEntries()
    if (!loaded) return false

    try {
      // 解锁时一次性尝试解密全部密文，任一记录失败都视为当前主密码不可用。
      const decryptedPayloads = await Promise.all(
        encryptedEntries.value.map((entry) => decryptEntry(entry, normalizedPassword))
      )
      masterPassword.value = normalizedPassword
      applyDecryptedPayloads(decryptedPayloads)
      unlocked.value = true
      await cleanupDeprecatedBillPayloads(decryptedPayloads)
      refreshUnlockSession()
      error.value = ''
      return true
    } catch (err) {
      records.value = []
      visibleTabs.value = [...ALL_TABS]
      accountCategories.value = []
      settingsEntryId.value = null
      unlocked.value = false
      masterPassword.value = ''
      error.value = '主密码不正确或数据无法解密'
      return false
    }
  }

  function lock() {
    // 锁定时清掉内存中的主密码、明文条目和可见 tab 设置，刷新页面也不会恢复明文状态。
    clearUnlockTimer()
    unlocked.value = false
    masterPassword.value = ''
    records.value = []
    visibleTabs.value = [...ALL_TABS]
    accountCategories.value = []
    settingsEntryId.value = null
    error.value = ''
  }

  async function postEncryptedPayload(payload: VaultRecord | VaultSettingsPayload) {
    const encrypted = await encryptPayload(payload)
    const response = await fetch('/api/vault', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(encrypted)
    })
    const data = await response.json() as VaultEntryResponse

    if (!data.success || !data.entry) {
      throw new Error(data.error || '保存失败')
    }

    encryptedEntries.value.unshift(data.entry)
    return decryptEntry(data.entry, masterPassword.value)
  }

  async function putEncryptedPayload(id: number, payload: VaultRecord | VaultSettingsPayload) {
    const encrypted = await encryptPayload(payload)
    const response = await fetch(`/api/vault/${id}`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(encrypted)
    })
    const data = await response.json() as VaultEntryResponse

    if (!data.success || !data.entry) {
      throw new Error(data.error || '更新失败')
    }

    encryptedEntries.value = encryptedEntries.value.map((entry) => (entry.id === id ? data.entry! : entry))
    return decryptEntry(data.entry, masterPassword.value)
  }

  async function createItem(item: VaultRecord): Promise<boolean> {
    if (!unlocked.value || !masterPassword.value) {
      error.value = '请先解锁随身记录'
      return false
    }

    saving.value = true
    error.value = ''

    try {
      const payload = await postEncryptedPayload(item)
      if (isVaultRecordPayload(payload)) {
        records.value.unshift(normalizeRecord(payload))
      }
      refreshUnlockSession()
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '保存失败'
      console.error('Failed to create record:', err)
      return false
    } finally {
      saving.value = false
    }
  }

  async function updateItem(id: number, item: VaultRecord): Promise<boolean> {
    if (!unlocked.value || !masterPassword.value) {
      error.value = '请先解锁随身记录'
      return false
    }

    saving.value = true
    error.value = ''

    try {
      const payload = await putEncryptedPayload(id, item)
      if (isVaultRecordPayload(payload)) {
        records.value = records.value.map((currentItem) => (
          currentItem.id === id ? normalizeRecord(payload) : currentItem
        ))
      }
      refreshUnlockSession()
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '更新失败'
      console.error('Failed to update record:', err)
      return false
    } finally {
      saving.value = false
    }
  }

  async function syncRecords(nextRecords: VaultRecord[]): Promise<{ created: number; updated: number; failed: number }> {
    if (!unlocked.value || !masterPassword.value) {
      error.value = '请先解锁随身记录'
      return { created: 0, updated: 0, failed: nextRecords.length }
    }

    saving.value = true
    error.value = ''
    let created = 0
    let updated = 0
    let failed = 0

    try {
      for (const record of nextRecords) {
        try {
          const normalizedRecord = normalizeRecord(record)
          const existingRecord = normalizedRecord.source
            ? records.value.find((item) => sourcesMatch(item.source, normalizedRecord.source))
            : null

          if (existingRecord?.id) {
            const payload = await putEncryptedPayload(existingRecord.id, {
              ...normalizedRecord,
              id: existingRecord.id
            })
            if (isVaultRecordPayload(payload)) {
              records.value = records.value.map((item) => (
                item.id === existingRecord.id ? normalizeRecord(payload) : item
              ))
              updated += 1
            }
          } else {
            const payload = await postEncryptedPayload(normalizedRecord)
            if (isVaultRecordPayload(payload)) {
              records.value.unshift(normalizeRecord(payload))
              created += 1
            }
          }
        } catch (err) {
          failed += 1
          console.error('Failed to sync record:', err)
        }
      }

      if (failed > 0) {
        error.value = `同步完成，${failed} 条失败`
      }

      refreshUnlockSession()
      return { created, updated, failed }
    } catch (err) {
      error.value = '同步失败'
      console.error('Failed to sync records:', err)
      return { created, updated, failed: failed || nextRecords.length }
    } finally {
      saving.value = false
    }
  }

  async function deleteItem(id: number): Promise<boolean> {
    saving.value = true
    error.value = ''

    try {
      const response = await fetch(`/api/vault/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      })
      const data = await response.json() as { success: boolean; error?: string }

      if (!data.success) {
        error.value = data.error || '删除失败'
        return false
      }

      encryptedEntries.value = encryptedEntries.value.filter((entry) => entry.id !== id)
      records.value = records.value.filter((item) => item.id !== id)
      refreshUnlockSession()
      return true
    } catch (err) {
      error.value = '删除失败'
      console.error('Failed to delete record:', err)
      return false
    } finally {
      saving.value = false
    }
  }

  async function saveVisibleTabs(nextTabs: VaultRecordType[]): Promise<boolean> {
    if (!unlocked.value || !masterPassword.value) {
      error.value = '请先解锁随身记录'
      return false
    }

    const normalizedTabs = normalizeVisibleTabs(nextTabs)
    const payload: VaultSettingsPayload = {
      id: settingsEntryId.value || undefined,
      type: 'settings',
      visibleTabs: normalizedTabs,
      accountCategories: accountCategories.value
    }

    saving.value = true
    error.value = ''

    try {
      const savedPayload = settingsEntryId.value
        ? await putEncryptedPayload(settingsEntryId.value, payload)
        : await postEncryptedPayload(payload)

      if (savedPayload.type === 'settings') {
        const settings = normalizeSettings(savedPayload)
        settingsEntryId.value = settings.id || null
        visibleTabs.value = settings.visibleTabs
        accountCategories.value = settings.accountCategories
      }
      refreshUnlockSession()
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '保存显示设置失败'
      console.error('Failed to save record tabs:', err)
      return false
    } finally {
      saving.value = false
    }
  }

  async function saveAccountCategories(nextCategories: string[]): Promise<boolean> {
    if (!unlocked.value || !masterPassword.value) {
      error.value = '请先解锁随身记录'
      return false
    }

    const normalizedCategories = normalizeAccountCategories(nextCategories)
    const payload: VaultSettingsPayload = {
      id: settingsEntryId.value || undefined,
      type: 'settings',
      visibleTabs: visibleTabs.value,
      accountCategories: normalizedCategories
    }

    saving.value = true
    error.value = ''

    try {
      const savedPayload = settingsEntryId.value
        ? await putEncryptedPayload(settingsEntryId.value, payload)
        : await postEncryptedPayload(payload)

      if (savedPayload.type === 'settings') {
        const settings = normalizeSettings(savedPayload)
        settingsEntryId.value = settings.id || null
        visibleTabs.value = settings.visibleTabs
        accountCategories.value = settings.accountCategories
      }
      refreshUnlockSession()
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '保存账号分类失败'
      console.error('Failed to save account categories:', err)
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    encryptedEntries,
    records,
    items,
    visibleTabs,
    accountCategories,
    unlocked,
    loading,
    saving,
    error,
    hasEntries,
    fetchEntries,
    unlock,
    lock,
    createItem,
    updateItem,
    syncRecords,
    deleteItem,
    saveVisibleTabs,
    saveAccountCategories
  }
})
