<template>
  <div class="vault-modal" @click.self="$emit('close')">
    <section class="vault-dialog" aria-label="密码本">
      <header class="vault-header">
        <div>
          <h2>密码本</h2>
          <p v-if="vaultStore.unlocked">{{ vaultStore.items.length }} 条记录</p>
          <p v-else>{{ vaultStore.hasEntries ? '已锁定' : '未初始化' }}</p>
        </div>
        <button class="vault-close" type="button" title="关闭" @click="$emit('close')">×</button>
      </header>

      <form v-if="!vaultStore.unlocked" class="vault-unlock" @submit.prevent="handleUnlock">
        <div class="vault-mark">
          <AppIcon name="vault" :size="30" />
        </div>
        <label class="vault-field">
          <span>主密码</span>
          <div class="vault-password-input">
            <input
              ref="passwordInputEl"
              v-model="masterPasswordInput"
              :type="masterPasswordVisible ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="输入主密码"
            />
            <button
              class="vault-eye-button"
              type="button"
              :title="masterPasswordVisible ? '隐藏' : '显示'"
              :aria-label="masterPasswordVisible ? '隐藏' : '显示'"
              @click="masterPasswordVisible = !masterPasswordVisible"
            >
              <AppIcon :name="masterPasswordVisible ? 'eyeOff' : 'eye'" :size="17" />
            </button>
          </div>
        </label>
        <p v-if="!vaultStore.hasEntries" class="vault-muted">首次保存记录时会使用当前主密码加密</p>
        <p v-if="vaultStore.error" class="vault-error">{{ vaultStore.error }}</p>
        <button class="vault-primary" type="submit" :disabled="vaultStore.loading || !masterPasswordInput.trim()">
          {{ vaultStore.hasEntries ? '解锁' : '进入' }}
        </button>
      </form>

      <div v-else class="vault-workspace">
        <aside class="vault-list-panel">
          <div class="vault-toolbar">
            <div class="vault-search">
              <AppIcon name="search" :size="16" />
              <input v-model="searchQuery" type="search" placeholder="搜索密码" autocomplete="off" />
            </div>
            <button class="vault-icon-button" type="button" title="新增" @click="startCreate">
              <AppIcon name="addSite" :size="18" />
            </button>
            <button class="vault-icon-button" type="button" title="批量导入" @click="startImport">
              <AppIcon name="upload" :size="18" />
            </button>
            <button class="vault-icon-button" type="button" title="锁定" @click="vaultStore.lock">
              <AppIcon name="auth" :size="17" />
            </button>
          </div>

          <div class="vault-list">
            <button
              v-for="item in filteredItems"
              :key="item.id"
              class="vault-item"
              :class="{ active: item.id === selectedItemId }"
              type="button"
              @click="selectItem(item)"
            >
              <span class="vault-item-icon">{{ getInitial(item.title) }}</span>
              <span class="vault-item-main">
                <strong>{{ item.title || '未命名' }}</strong>
                <small>{{ item.username || item.url || '无账号' }}</small>
              </span>
            </button>

            <div v-if="filteredItems.length === 0" class="vault-empty">
              {{ searchQuery.trim() ? '无匹配记录' : '暂无记录' }}
            </div>
          </div>
        </aside>

        <section class="vault-detail">
          <div v-if="selectedItem && !editing && !importing" class="vault-preview">
            <div class="vault-preview-title">
              <span class="vault-item-icon large">{{ getInitial(selectedItem.title) }}</span>
              <div>
                <h3>{{ selectedItem.title || '未命名' }}</h3>
                <a v-if="selectedItem.url" :href="normalizedUrl(selectedItem.url)" target="_blank" rel="noreferrer">
                  {{ selectedItem.url }}
                </a>
              </div>
            </div>

            <div class="vault-data-grid">
              <div class="vault-data-row">
                <span>账号</span>
                <strong>{{ selectedItem.username || '-' }}</strong>
                <button type="button" @click="copyText(selectedItem.username)">复制</button>
              </div>
              <div class="vault-data-row">
                <span>密码</span>
                <strong>{{ passwordVisible ? selectedItem.password : maskPassword(selectedItem.password) }}</strong>
                <button
                  class="vault-eye-button"
                  type="button"
                  :title="passwordVisible ? '隐藏' : '显示'"
                  :aria-label="passwordVisible ? '隐藏' : '显示'"
                  @click="passwordVisible = !passwordVisible"
                >
                  <AppIcon :name="passwordVisible ? 'eyeOff' : 'eye'" :size="17" />
                </button>
                <button type="button" @click="copyText(selectedItem.password)">复制</button>
              </div>
              <div v-if="selectedItem.note" class="vault-note">
                {{ selectedItem.note }}
              </div>
            </div>

            <div class="vault-detail-actions">
              <button class="vault-secondary" type="button" @click="startEdit(selectedItem)">编辑</button>
              <button class="vault-danger" type="button" @click="handleDelete(selectedItem)">删除</button>
            </div>
          </div>

          <form v-else-if="importing" class="vault-form" @submit.prevent="handleImport">
            <h3>批量导入</h3>
            <input
              ref="importFileInputEl"
              class="vault-file-input"
              type="file"
              accept=".json,.csv,application/json,text/csv,text/plain"
              @change="handleImportFile"
            />
            <div class="vault-import-actions">
              <button class="vault-secondary" type="button" @click="importFileInputEl?.click()">选择文件</button>
              <button class="vault-secondary" type="button" @click="fillImportExample">示例</button>
            </div>
            <label class="vault-field">
              <span>JSON / CSV</span>
              <textarea
                v-model="importText"
                rows="12"
                placeholder="title,url,username,password,note"
              ></textarea>
            </label>
            <div class="vault-import-summary">
              <span>{{ parsedImportItems.length }} 条可导入</span>
              <strong v-if="importError">{{ importError }}</strong>
            </div>
            <p v-if="vaultStore.error" class="vault-error">{{ vaultStore.error }}</p>
            <div class="vault-form-actions">
              <button class="vault-secondary" type="button" @click="cancelImport">取消</button>
              <button class="vault-primary" type="submit" :disabled="vaultStore.saving || parsedImportItems.length === 0">
                导入
              </button>
            </div>
          </form>

          <form v-else class="vault-form" @submit.prevent="handleSave">
            <h3>{{ editingId ? '编辑记录' : '新增记录' }}</h3>
            <label class="vault-field">
              <span>名称</span>
              <input v-model="form.title" type="text" autocomplete="off" placeholder="例如 GitHub" />
            </label>
            <label class="vault-field">
              <span>网址</span>
              <input v-model="form.url" type="url" autocomplete="off" placeholder="https://" />
            </label>
            <label class="vault-field">
              <span>账号</span>
              <input v-model="form.username" type="text" autocomplete="username" />
            </label>
            <label class="vault-field">
              <span>密码</span>
              <div class="vault-password-input">
                <input
                  v-model="form.password"
                  :type="formPasswordVisible ? 'text' : 'password'"
                  autocomplete="new-password"
                />
                <button
                  class="vault-eye-button"
                  type="button"
                  :title="formPasswordVisible ? '隐藏' : '显示'"
                  :aria-label="formPasswordVisible ? '隐藏' : '显示'"
                  @click="formPasswordVisible = !formPasswordVisible"
                >
                  <AppIcon :name="formPasswordVisible ? 'eyeOff' : 'eye'" :size="17" />
                </button>
              </div>
            </label>
            <label class="vault-field">
              <span>备注</span>
              <textarea v-model="form.note" rows="4"></textarea>
            </label>
            <p v-if="vaultStore.error" class="vault-error">{{ vaultStore.error }}</p>
            <div class="vault-form-actions">
              <button class="vault-secondary" type="button" @click="cancelEdit">取消</button>
              <button class="vault-secondary" type="button" @click="generatePassword">生成密码</button>
              <button class="vault-primary" type="submit" :disabled="vaultStore.saving || !canSave">
                保存
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'
import { useVaultStore, type VaultItem } from '@/stores/vault'

defineEmits<{
  close: []
}>()

const vaultStore = useVaultStore()
const masterPasswordInput = ref('')
const passwordInputEl = ref<HTMLInputElement | null>(null)
const importFileInputEl = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')
const selectedItemId = ref<number | null>(null)
const editing = ref(false)
const importing = ref(false)
const editingId = ref<number | null>(null)
const passwordVisible = ref(false)
const formPasswordVisible = ref(false)
const masterPasswordVisible = ref(false)
const importText = ref('')

const form = reactive<VaultItem>({
  title: '',
  username: '',
  password: '',
  url: '',
  note: ''
})

const filteredItems = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()
  if (!keyword) return vaultStore.items

  return vaultStore.items.filter((item) => (
    item.title.toLowerCase().includes(keyword)
    || item.username.toLowerCase().includes(keyword)
    || item.url.toLowerCase().includes(keyword)
    || item.note.toLowerCase().includes(keyword)
  ))
})

const selectedItem = computed(() => {
  return vaultStore.items.find((item) => item.id === selectedItemId.value) || filteredItems.value[0] || null
})

const canSave = computed(() => {
  return Boolean(form.title.trim() && (form.username.trim() || form.password.trim() || form.url.trim()))
})

const importParseResult = computed(() => parseImportText(importText.value))
const parsedImportItems = computed(() => importParseResult.value.items)
const importError = computed(() => importParseResult.value.error)

onMounted(async () => {
  await vaultStore.fetchEntries()
  await nextTick()
  passwordInputEl.value?.focus()
})

async function handleUnlock() {
  // 只把主密码交给 vault store 派生密钥，解锁成功后立即清空输入框。
  const success = await vaultStore.unlock(masterPasswordInput.value)
  if (!success) return

  masterPasswordInput.value = ''
  selectedItemId.value = vaultStore.items[0]?.id || null
  if (vaultStore.items.length === 0) {
    startCreate()
  }
}

function getInitial(title: string) {
  const trimmed = title.trim()
  return (trimmed[0] || '#').toUpperCase()
}

function normalizedUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function maskPassword(password: string) {
  if (!password) return '-'
  return '•'.repeat(Math.min(Math.max(password.length, 6), 16))
}

async function copyText(value: string) {
  if (!value) return
  await navigator.clipboard.writeText(value)
}

function resetForm() {
  form.title = ''
  form.username = ''
  form.password = ''
  form.url = ''
  form.note = ''
  formPasswordVisible.value = false
}

function fillForm(item: VaultItem) {
  form.title = item.title
  form.username = item.username
  form.password = item.password
  form.url = item.url
  form.note = item.note
  formPasswordVisible.value = false
}

function startCreate() {
  resetForm()
  importing.value = false
  editingId.value = null
  editing.value = true
}

function startEdit(item: VaultItem) {
  fillForm(item)
  importing.value = false
  editingId.value = item.id || null
  editing.value = true
}

function selectItem(item: VaultItem) {
  selectedItemId.value = item.id || null
  editing.value = false
  importing.value = false
  passwordVisible.value = false
}

function cancelEdit() {
  editing.value = false
  editingId.value = null
  resetForm()
}

function startImport() {
  // 导入面板复用右侧详情区，避免在密码本弹窗里再叠一层弹窗。
  editing.value = false
  editingId.value = null
  importing.value = true
  passwordVisible.value = false
}

function cancelImport() {
  importing.value = false
  importText.value = ''
  if (importFileInputEl.value) {
    importFileInputEl.value.value = ''
  }
}

async function handleSave() {
  const data = {
    title: form.title,
    username: form.username,
    password: form.password,
    url: form.url,
    note: form.note
  }

  const success = editingId.value
    ? await vaultStore.updateItem(editingId.value, data)
    : await vaultStore.createItem(data)

  if (!success) return

  selectedItemId.value = editingId.value || vaultStore.items[0]?.id || null
  cancelEdit()
}

async function handleDelete(item: VaultItem) {
  if (!item.id) return
  if (!confirm(`确定要删除"${item.title || '未命名'}"吗？`)) return

  const success = await vaultStore.deleteItem(item.id)
  if (!success) return

  selectedItemId.value = vaultStore.items[0]?.id || null
  editing.value = false
}

async function handleImport() {
  const items = parsedImportItems.value
  if (items.length === 0) return

  // createItems 会逐条加密后写入，导入解析出的明文不会发送到 API。
  const savedCount = await vaultStore.createItems(items)
  if (savedCount === 0) return

  selectedItemId.value = vaultStore.items[0]?.id || null
  if (savedCount < items.length) {
    alert(`已导入 ${savedCount} 条，剩余记录导入失败`)
    return
  }

  cancelImport()
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // 文件内容只进入当前页面内存，仍需点击导入才会加密保存。
  importText.value = await file.text()
}

function fillImportExample() {
  importText.value = [
    'title,url,username,password,note',
    'GitHub,https://github.com,hello@example.com,change-me,开发账号'
  ].join('\n')
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=?'
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  form.password = Array.from(bytes)
    .map((byte) => chars[byte % chars.length])
    .join('')
  formPasswordVisible.value = true
}

function parseImportText(value: string): { items: VaultItem[]; error: string } {
  const trimmed = value.trim()
  if (!trimmed) return { items: [], error: '' }

  try {
    // JSON 更适合从其它密码工具导出的结构化数据，CSV 方便手工整理。
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      return parseJsonImport(trimmed)
    }

    return parseCsvImport(trimmed)
  } catch (error) {
    return {
      items: [],
      error: error instanceof Error ? error.message : '导入内容无法解析'
    }
  }
}

function parseJsonImport(value: string): { items: VaultItem[]; error: string } {
  const parsed = JSON.parse(value)
  // 兼容常见导出格式：直接数组，或包在 items/passwords/logins/entries 字段里。
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed.items || parsed.passwords || parsed.logins || parsed.entries

  if (!Array.isArray(rows)) {
    throw new Error('JSON 需要是数组')
  }

  return normalizeImportRows(rows)
}

function parseCsvImport(value: string): { items: VaultItem[]; error: string } {
  const rows = parseCsvRows(value)
  if (rows.length === 0) return { items: [], error: '' }

  const headers = rows[0].map((header) => header.trim().toLowerCase())
  // 支持有表头和无表头两种 CSV；有表头时按字段名映射，无表头时按固定列顺序。
  const hasHeader = headers.some((header) => ['title', 'name', 'url', 'website', 'username', 'user', 'login', 'password', 'pass', 'note'].includes(header))
  const dataRows = hasHeader ? rows.slice(1) : rows

  const objects = dataRows.map((row) => {
    if (hasHeader) {
      return headers.reduce<Record<string, string>>((result, header, index) => {
        result[header] = row[index] || ''
        return result
      }, {})
    }

    return {
      title: row[0] || '',
      url: row[1] || '',
      username: row[2] || '',
      password: row[3] || '',
      note: row[4] || ''
    }
  })

  return normalizeImportRows(objects)
}

function parseCsvRows(value: string) {
  // 轻量 CSV 解析器：支持双引号包裹字段和 "" 转义，足够覆盖常见密码导出文件。
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    const nextChar = value[index + 1]

    if (char === '"' && inQuotes && nextChar === '"') {
      field += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(field)
      field = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1
      }
      row.push(field)
      if (row.some((cell) => cell.trim())) {
        rows.push(row)
      }
      row = []
      field = ''
      continue
    }

    field += char
  }

  row.push(field)
  if (row.some((cell) => cell.trim())) {
    rows.push(row)
  }

  return rows
}

function normalizeImportRows(rows: unknown[]): { items: VaultItem[]; error: string } {
  const items = rows
    .map((row) => normalizeImportRow(row))
    .filter((item): item is VaultItem => Boolean(item))

  return {
    items,
    error: items.length === 0 ? '未解析到可导入记录' : ''
  }
}

function normalizeImportRow(row: unknown): VaultItem | null {
  if (!row || typeof row !== 'object') return null

  const record = row as Record<string, unknown>
  const title = pickText(record, ['title', 'name', 'site', 'label'])
  const url = pickText(record, ['url', 'website', 'uri', 'origin'])
  const username = pickText(record, ['username', 'user', 'login', 'email', 'account'])
  const password = pickText(record, ['password', 'pass', 'secret'])
  const note = pickText(record, ['note', 'notes', 'remark', 'description'])
  const fallbackTitle = title || url || username

  // 至少需要一个可展示标题，并且必须包含账号、密码或网址中的任意有效信息。
  if (!fallbackTitle || (!username && !password && !url)) return null

  return {
    title: fallbackTitle,
    username,
    password,
    url,
    note
  }
}

function pickText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }

  return ''
}
</script>

<style scoped>
.vault-modal {
  position: fixed;
  inset: 0;
  z-index: 1200;
  padding: var(--spacing-lg);
  background: rgba(0, 0, 0, 0.56);
  display: flex;
  align-items: center;
  justify-content: center;
}

.vault-dialog {
  width: min(1080px, 96vw);
  height: min(720px, 92vh);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(245, 247, 251, 0.92));
  color: #111827;
  border: 1px solid rgba(255, 255, 255, 0.44);
  border-radius: var(--radius-lg);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.vault-header {
  height: 74px;
  padding: 0 var(--spacing-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.vault-header h2 {
  font-size: 20px;
  font-weight: 700;
}

.vault-header p,
.vault-muted {
  margin-top: 4px;
  color: #6b7280;
  font-size: 13px;
}

.vault-close {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  color: #4b5563;
  font-size: 22px;
}

.vault-close:hover,
.vault-icon-button:hover {
  background: rgba(15, 23, 42, 0.08);
}

.vault-unlock {
  width: min(380px, 88vw);
  margin: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.vault-mark {
  width: 62px;
  height: 62px;
  margin: 0 auto var(--spacing-sm);
  border-radius: 20px;
  color: #ffffff;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 18px 36px rgba(37, 99, 235, 0.28);
}

.vault-workspace {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr);
}

.vault-list-panel {
  min-height: 0;
  border-right: 1px solid rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
}

.vault-toolbar {
  padding: var(--spacing-md);
  display: flex;
  gap: var(--spacing-sm);
}

.vault-search {
  min-width: 0;
  flex: 1;
  height: 38px;
  padding: 0 10px;
  border-radius: var(--radius-md);
  background: rgba(15, 23, 42, 0.06);
  color: #374151;
  display: flex;
  align-items: center;
  gap: 8px;
}

.vault-search input,
.vault-field input,
.vault-field textarea {
  width: 100%;
  min-width: 0;
  background: transparent;
  color: #111827;
  font-size: 14px;
}

.vault-icon-button {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  color: #374151;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.vault-eye-button {
  width: 36px;
  min-width: 36px;
  height: 36px;
  padding: 0;
  border-radius: var(--radius-md);
  color: #374151;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.vault-eye-button:hover {
  background: rgba(15, 23, 42, 0.1);
}

.vault-list {
  min-height: 0;
  flex: 1;
  padding: 0 var(--spacing-md) var(--spacing-md);
  overflow-y: auto;
}

.vault-item {
  width: 100%;
  min-height: 62px;
  padding: 10px;
  border-radius: var(--radius-md);
  color: #111827;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
}

.vault-item:hover,
.vault-item.active {
  background: rgba(37, 99, 235, 0.1);
}

.vault-item-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(124, 58, 237, 0.18));
  color: #1d4ed8;
  font-size: 15px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.vault-item-icon.large {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  font-size: 20px;
}

.vault-item-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.vault-item-main strong,
.vault-preview-title h3 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vault-item-main small {
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vault-detail {
  min-width: 0;
  min-height: 0;
  padding: var(--spacing-lg);
  overflow-y: auto;
}

.vault-preview,
.vault-form {
  max-width: 620px;
  margin: 0 auto;
}

.vault-preview-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.vault-preview-title h3,
.vault-form h3 {
  font-size: 24px;
  font-weight: 750;
}

.vault-preview-title a {
  display: inline-block;
  max-width: 100%;
  margin-top: 6px;
  color: #2563eb;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vault-data-grid,
.vault-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.vault-data-row {
  min-height: 52px;
  padding: 12px;
  border-radius: var(--radius-md);
  background: rgba(15, 23, 42, 0.05);
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
}

.vault-data-row span,
.vault-field span {
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
}

.vault-data-row strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.vault-data-row button,
.vault-secondary,
.vault-danger,
.vault-primary,
.vault-password-input button {
  height: 36px;
  padding: 0 var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 700;
}

.vault-data-row .vault-eye-button,
.vault-password-input .vault-eye-button {
  padding: 0;
}

.vault-data-row button,
.vault-secondary,
.vault-password-input button {
  background: rgba(15, 23, 42, 0.07);
  color: #374151;
}

.vault-primary {
  background: #2563eb;
  color: #ffffff;
}

.vault-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.vault-danger {
  background: rgba(220, 38, 38, 0.1);
  color: #b91c1c;
}

.vault-note {
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background: rgba(15, 23, 42, 0.05);
  color: #374151;
  white-space: pre-wrap;
  line-height: 1.7;
}

.vault-detail-actions,
.vault-form-actions {
  margin-top: var(--spacing-lg);
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.vault-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vault-field input,
.vault-field textarea,
.vault-password-input {
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: var(--radius-md);
  background: rgba(15, 23, 42, 0.04);
}

.vault-password-input input {
  min-height: 0;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.vault-field textarea {
  min-height: 96px;
  padding: 12px;
  resize: vertical;
}

.vault-password-input {
  padding-right: 6px;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.vault-password-input .vault-eye-button {
  background: transparent;
}

.vault-file-input {
  display: none;
}

.vault-import-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.vault-import-summary {
  min-height: 38px;
  padding: 0 12px;
  border-radius: var(--radius-md);
  background: rgba(15, 23, 42, 0.05);
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  font-size: 13px;
  font-weight: 700;
}

.vault-import-summary strong {
  color: #dc2626;
  font-weight: 700;
}

.vault-error {
  color: #dc2626;
  font-size: 13px;
}

.vault-empty {
  padding: var(--spacing-lg);
  color: #6b7280;
  text-align: center;
}

:global(.theme-cyberpunk) .vault-dialog {
  background: rgba(10, 14, 39, 0.96);
  color: #00ffff;
  border: 2px solid rgba(0, 255, 255, 0.86);
  box-shadow: 0 0 34px rgba(0, 255, 255, 0.34);
}

:global(.theme-cyberpunk) .vault-header,
:global(.theme-cyberpunk) .vault-list-panel {
  border-color: rgba(0, 255, 255, 0.26);
}

:global(.theme-cyberpunk) .vault-search,
:global(.theme-cyberpunk) .vault-data-row,
:global(.theme-cyberpunk) .vault-note,
:global(.theme-cyberpunk) .vault-import-summary,
:global(.theme-cyberpunk) .vault-field input,
:global(.theme-cyberpunk) .vault-field textarea,
:global(.theme-cyberpunk) .vault-password-input {
  background: rgba(0, 255, 255, 0.08);
  border-color: rgba(0, 255, 255, 0.32);
  color: #00ffff;
}

:global(.theme-cyberpunk) .vault-item,
:global(.theme-cyberpunk) .vault-close,
:global(.theme-cyberpunk) .vault-icon-button,
:global(.theme-cyberpunk) .vault-eye-button,
:global(.theme-cyberpunk) .vault-field input,
:global(.theme-cyberpunk) .vault-field textarea,
:global(.theme-cyberpunk) .vault-search input {
  color: #00ffff;
}

:global(.theme-cyberpunk) .vault-item:hover,
:global(.theme-cyberpunk) .vault-item.active {
  background: rgba(255, 0, 255, 0.14);
}

:global(.theme-cyberpunk) .vault-header p,
:global(.theme-cyberpunk) .vault-muted,
:global(.theme-cyberpunk) .vault-field span,
:global(.theme-cyberpunk) .vault-item-main small,
:global(.theme-cyberpunk) .vault-data-row span,
:global(.theme-cyberpunk) .vault-import-summary,
:global(.theme-cyberpunk) .vault-empty {
  color: rgba(0, 255, 255, 0.72);
}

:global(.theme-cyberpunk) .vault-primary {
  background: rgba(255, 0, 255, 0.32);
  box-shadow: 0 0 18px rgba(255, 0, 255, 0.36);
}

@media (max-width: 760px) {
  .vault-modal {
    padding: var(--spacing-sm);
  }

  .vault-dialog {
    height: 94vh;
  }

  .vault-workspace {
    grid-template-columns: 1fr;
    grid-template-rows: 240px minmax(0, 1fr);
  }

  .vault-list-panel {
    border-right: 0;
    border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  }

  .vault-data-row {
    grid-template-columns: 1fr auto auto;
  }

  .vault-data-row span {
    grid-column: 1 / -1;
  }
}
</style>
