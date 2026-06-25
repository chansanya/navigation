import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface VaultItem {
  id?: number
  title: string
  username: string
  password: string
  url: string
  note: string
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
const encoder = new TextEncoder()
const decoder = new TextDecoder()

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

function normalizeItem(item: VaultItem): VaultItem {
  // 加密前做轻量归一化，保证解密后的展示数据结构稳定。
  return {
    id: item.id,
    title: item.title.trim(),
    username: item.username.trim(),
    password: item.password,
    url: item.url.trim(),
    note: item.note.trim(),
    created_at: item.created_at,
    updated_at: item.updated_at
  }
}

export const useVaultStore = defineStore('vault', () => {
  const encryptedEntries = ref<EncryptedVaultEntry[]>([])
  const items = ref<VaultItem[]>([])
  const unlocked = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const masterPassword = ref('')

  const hasEntries = computed(() => encryptedEntries.value.length > 0)

  async function fetchEntries(): Promise<boolean> {
    loading.value = true
    error.value = ''

    try {
      const response = await fetch('/api/vault', {
        credentials: 'same-origin'
      })
      const data = await response.json() as VaultListResponse

      if (!data.success) {
        error.value = data.error || '密码本加载失败'
        return false
      }

      // 这里拿到的仍是密文，真正解密必须等用户输入主密码。
      encryptedEntries.value = data.entries || []
      return true
    } catch (err) {
      error.value = '网络错误'
      console.error('Failed to fetch vault:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  async function encryptItem(item: VaultItem): Promise<EncryptedVaultEntry> {
    const cryptoApi = getWebCrypto()
    const salt = new Uint8Array(16)
    const iv = new Uint8Array(12)
    cryptoApi.getRandomValues(salt)
    cryptoApi.getRandomValues(iv)

    // 每条记录使用独立 salt 和 iv，即使内容相同，数据库里的密文也不同。
    const key = await deriveKey(masterPassword.value, salt)
    const payload = JSON.stringify(normalizeItem(item))
    const ciphertext = await cryptoApi.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: bytesToArrayBuffer(iv)
      },
      key,
      bytesToArrayBuffer(encoder.encode(payload))
    )

    return {
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext))
    }
  }

  async function decryptEntry(entry: EncryptedVaultEntry, password: string): Promise<VaultItem> {
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
    const item = JSON.parse(decoder.decode(decrypted)) as VaultItem

    return {
      ...normalizeItem(item),
      id: entry.id,
      created_at: entry.created_at,
      updated_at: entry.updated_at
    }
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
      // 解锁时一次性尝试解密全部记录，任一记录失败都视为当前主密码不可用。
      const decryptedItems = await Promise.all(
        encryptedEntries.value.map((entry) => decryptEntry(entry, normalizedPassword))
      )
      masterPassword.value = normalizedPassword
      items.value = decryptedItems
      unlocked.value = true
      error.value = ''
      return true
    } catch (err) {
      items.value = []
      unlocked.value = false
      masterPassword.value = ''
      error.value = '主密码不正确或数据无法解密'
      return false
    }
  }

  function lock() {
    // 锁定时清掉内存中的主密码和明文条目，刷新页面也不会恢复明文状态。
    unlocked.value = false
    masterPassword.value = ''
    items.value = []
    error.value = ''
  }

  async function createItem(item: VaultItem): Promise<boolean> {
    if (!unlocked.value || !masterPassword.value) {
      error.value = '请先解锁密码本'
      return false
    }

    saving.value = true
    error.value = ''

    try {
      const encrypted = await encryptItem(item)
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
        error.value = data.error || '保存失败'
        return false
      }

      encryptedEntries.value.unshift(data.entry)
      items.value.unshift(await decryptEntry(data.entry, masterPassword.value))
      return true
    } catch (err) {
      error.value = '保存失败'
      console.error('Failed to create vault item:', err)
      return false
    } finally {
      saving.value = false
    }
  }

  async function createItems(nextItems: VaultItem[]): Promise<number> {
    if (!unlocked.value || !masterPassword.value) {
      error.value = '请先解锁密码本'
      return 0
    }

    saving.value = true
    error.value = ''
    let savedCount = 0

    try {
      for (const item of nextItems) {
        // 批量导入也逐条走同一套加密保存路径，避免出现明文批量写入捷径。
        const encrypted = await encryptItem(item)
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
          error.value = data.error || '部分记录导入失败'
          break
        }

        encryptedEntries.value.unshift(data.entry)
        items.value.unshift(await decryptEntry(data.entry, masterPassword.value))
        savedCount += 1
      }

      return savedCount
    } catch (err) {
      error.value = savedCount > 0 ? '部分记录导入失败' : '导入失败'
      console.error('Failed to import vault items:', err)
      return savedCount
    } finally {
      saving.value = false
    }
  }

  async function updateItem(id: number, item: VaultItem): Promise<boolean> {
    if (!unlocked.value || !masterPassword.value) {
      error.value = '请先解锁密码本'
      return false
    }

    saving.value = true
    error.value = ''

    try {
      const encrypted = await encryptItem(item)
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
        error.value = data.error || '更新失败'
        return false
      }

      encryptedEntries.value = encryptedEntries.value.map((entry) => (entry.id === id ? data.entry! : entry))
      items.value = items.value.map((currentItem) => (
        currentItem.id === id ? { ...normalizeItem(item), id, updated_at: data.entry!.updated_at } : currentItem
      ))
      return true
    } catch (err) {
      error.value = '更新失败'
      console.error('Failed to update vault item:', err)
      return false
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
      items.value = items.value.filter((item) => item.id !== id)
      return true
    } catch (err) {
      error.value = '删除失败'
      console.error('Failed to delete vault item:', err)
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    encryptedEntries,
    items,
    unlocked,
    loading,
    saving,
    error,
    hasEntries,
    fetchEntries,
    unlock,
    lock,
    createItem,
    createItems,
    updateItem,
    deleteItem
  }
})
