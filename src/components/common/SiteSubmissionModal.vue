<template>
  <div class="submission-overlay" @click.self="$emit('close')">
    <form class="submission-dialog" @submit.prevent="handleSubmit">
      <div class="dialog-header">
        <h2>推荐站点</h2>
        <button type="button" class="btn-close" @click="$emit('close')">×</button>
      </div>

      <label class="field">
        <span>站点链接 *</span>
        <div class="url-row">
          <input v-model="form.url" type="url" placeholder="https://example.com" required @blur="checkDuplicateUrl(true)" />
          <button type="button" class="btn-extract" :disabled="extracting || duplicateChecking || !form.url.trim()" @click="handleExtract">
            {{ extracting ? '提取中' : '自动提取' }}
          </button>
        </div>
      </label>

      <label class="field">
        <span>站点名称 *</span>
        <input v-model="form.name" type="text" maxlength="80" placeholder="站点名称" required />
      </label>

      <label class="field">
        <span>联系邮箱 *</span>
        <input v-model="form.email" type="email" maxlength="120" placeholder="name@example.com" required />
      </label>

      <label class="field">
        <span>分类</span>
        <select v-model="form.category">
          <option v-for="category in categories" :key="category.name" :value="category.name">
            {{ category.name }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>图标</span>
        <textarea v-model="form.icon" rows="2" placeholder="可留空，收录后显示默认图标"></textarea>
      </label>

      <label class="field">
        <span>推荐理由</span>
        <textarea v-model="form.description" rows="3" maxlength="240" placeholder="简单写一下它好在哪里"></textarea>
      </label>

      <p v-if="duplicateChecking" class="message muted">正在检测是否重复...</p>
      <p v-if="duplicateMessage" class="message error">{{ duplicateMessage }}</p>
      <p v-if="message" class="message" :class="{ error: hasError }">{{ message }}</p>

      <div class="dialog-actions">
        <button type="button" class="btn-secondary" @click="$emit('close')">取消</button>
        <button type="submit" class="btn-primary" :disabled="submitting || duplicateChecking || Boolean(duplicateMessage)">
          {{ duplicateChecking ? '检测中' : '提交审核' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Category {
  id?: number
  name: string
  sort: number
}

const emit = defineEmits<{
  close: []
  submitted: []
}>()

const form = ref({
  name: '',
  url: '',
  icon: '',
  category: '其他',
  description: '',
  email: ''
})
const categories = ref<Category[]>([])
const extracting = ref(false)
const submitting = ref(false)
const message = ref('')
const hasError = ref(false)
const duplicateChecking = ref(false)
const duplicateMessage = ref('')
let duplicateTimer: ReturnType<typeof setTimeout> | null = null
let duplicateRequestId = 0

onMounted(() => {
  fetchCategories()
})

onBeforeUnmount(() => {
  if (duplicateTimer) {
    clearTimeout(duplicateTimer)
  }
})

watch(() => form.value.url, () => {
  duplicateMessage.value = ''
  if (duplicateTimer) {
    clearTimeout(duplicateTimer)
  }

  if (!form.value.url.trim()) return

  duplicateTimer = setTimeout(() => {
    checkDuplicateUrl()
  }, 450)
})

async function fetchCategories() {
  try {
    const response = await fetch('/api/categories')
    const data = await response.json() as { success: boolean; categories?: Category[] }
    if (data.success && data.categories) {
      categories.value = data.categories
      if (!categories.value.some((category) => category.name === form.value.category)) {
        form.value.category = categories.value[0]?.name || '其他'
      }
    }
  } catch (error) {
    console.error('Failed to fetch categories:', error)
  }
}

function normalizeUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function duplicateText(source?: string | null) {
  if (source === 'submission') return '该站点已提交审核，请勿重复提交'
  return '该站点已收录，请勿重复提交'
}

async function checkDuplicateUrl(force = false) {
  const url = normalizeUrl(form.value.url)
  if (!url) {
    duplicateMessage.value = ''
    return false
  }

  const requestId = ++duplicateRequestId
  duplicateChecking.value = true

  try {
    const params = new URLSearchParams({
      url,
      includePending: '1'
    })
    const response = await fetch(`/api/sites/check-url?${params.toString()}`)
    const data = await response.json() as {
      success: boolean
      exists?: boolean
      source?: string | null
      error?: string
    }

    if (requestId !== duplicateRequestId) return false

    if (!data.success) {
      if (force) duplicateMessage.value = data.error || 'URL 检测失败'
      return false
    }

    duplicateMessage.value = data.exists ? duplicateText(data.source) : ''
    return Boolean(data.exists)
  } catch {
    if (requestId === duplicateRequestId && force) {
      duplicateMessage.value = 'URL 检测失败，请稍后重试'
    }
    return false
  } finally {
    if (requestId === duplicateRequestId) {
      duplicateChecking.value = false
    }
  }
}

async function handleExtract() {
  const url = normalizeUrl(form.value.url)
  if (!url) return

  const duplicated = await checkDuplicateUrl(true)
  if (duplicated) return

  extracting.value = true
  message.value = ''

  try {
    const response = await fetch('/api/sites/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    })
    const data = await response.json() as {
      success: boolean
      info?: { title?: string; description?: string; icon?: string }
      error?: string
    }

    form.value.url = url
    if (data.success && data.info) {
      form.value.name = form.value.name || data.info.title || ''
      form.value.description = form.value.description || data.info.description || ''
      form.value.icon = form.value.icon || data.info.icon || ''
      message.value = '已填充站点信息'
      hasError.value = false
    } else {
      message.value = data.error || '自动提取失败'
      hasError.value = true
    }
  } catch {
    message.value = '自动提取失败'
    hasError.value = true
  } finally {
    extracting.value = false
  }
}

async function handleSubmit() {
  submitting.value = true
  message.value = ''
  hasError.value = false

  try {
    const duplicated = await checkDuplicateUrl(true)
    if (duplicated) return

    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...form.value,
        url: normalizeUrl(form.value.url)
      })
    })
    const data = await response.json() as { success: boolean; error?: string }

    if (data.success) {
      emit('submitted')
      message.value = '已提交，等待管理员审核'
      hasError.value = false
      return
    }

    message.value = data.error || '提交失败'
    hasError.value = true
  } catch {
    message.value = '网络错误'
    hasError.value = true
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.submission-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  background: rgba(0, 0, 0, 0.46);
}

.submission-dialog {
  width: min(100%, 520px);
  max-height: min(92vh, 760px);
  overflow-y: auto;
  padding: var(--spacing-lg);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
  color: #111827;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
}

.dialog-header,
.dialog-actions,
.url-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.dialog-header {
  justify-content: space-between;
  margin-bottom: var(--spacing-md);
}

.dialog-header h2 {
  font-size: 20px;
  font-weight: 700;
}

.btn-close {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  font-size: 24px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: var(--spacing-md);
  font-size: 13px;
  font-weight: 600;
}

.field input,
.field textarea,
.field select {
  width: 100%;
  min-width: 0;
  padding: 11px 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: var(--radius-sm);
  background: white;
  color: #111827;
  font: inherit;
  font-weight: 400;
}

.field textarea {
  resize: vertical;
}

.url-row input {
  flex: 1;
}

.btn-extract,
.btn-primary,
.btn-secondary {
  height: 38px;
  padding: 0 var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.btn-extract,
.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-secondary {
  background: rgba(0, 0, 0, 0.06);
  color: #374151;
}

.dialog-actions {
  justify-content: flex-end;
}

.message {
  margin-bottom: var(--spacing-md);
  font-size: 13px;
  color: #047857;
}

.message.muted {
  color: #6b7280;
}

.message.error {
  color: #b91c1c;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
