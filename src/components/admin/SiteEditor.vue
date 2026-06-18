<template>
  <div class="site-editor">
    <h2>{{ isEdit ? '编辑站点' : '新增站点' }}</h2>
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label>站点链接 *</label>
        <div class="url-input-group">
          <input v-model="formData.url" type="url" placeholder="https://example.com" required @blur="checkDuplicateUrl(true)" />
          <button type="button" class="btn-extract" @click="handleExtract" :disabled="extracting || duplicateChecking || !formData.url">
            {{ extracting ? '提取中...' : '自动提取' }}
          </button>
        </div>
        <p v-if="duplicateChecking" class="duplicate-checking">正在检测是否重复...</p>
        <p v-if="duplicateMessage" class="extract-error">{{ duplicateMessage }}</p>
        <p v-if="extractError" class="extract-error">{{ extractError }}</p>
        <p v-if="extractSuccess" class="extract-success">✓ 已自动填充站点信息</p>
      </div>

      <div class="form-group">
        <label>站点名称 *</label>
        <input v-model="formData.name" type="text" placeholder="例如：GitHub" required />
      </div>

      <div class="form-group">
        <label>站点图标</label>
        <textarea v-model="formData.icon" rows="2" placeholder="图标 URL（留空使用主题默认图标）"></textarea>

        <!-- 图标方案选择 -->
        <div v-if="iconOptions.length > 0" class="icon-options">
          <label>选择图标方案：</label>
          <div class="icon-options-list">
            <button
              v-for="(option, index) in iconOptions"
              :key="index"
              type="button"
              class="icon-option-btn"
              :class="{ active: formData.icon === option.url, error: option.error }"
              @click="selectIconOption(option.url)"
            >
              <div class="icon-option-preview">
                <img v-if="!option.error" :src="option.url" alt="图标预览" @error="handleOptionIconError(index)" />
                <div v-else class="icon-placeholder-small">✕</div>
              </div>
              <span>{{ option.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label>分类</label>
        <div v-if="!showCustomCategory" class="category-select-group">
          <div class="custom-select" :class="{ open: dropdownOpen }" @click="dropdownOpen = !dropdownOpen" v-click-outside="() => dropdownOpen = false">
            <div class="select-trigger">
              <span v-if="formData.category" class="selected-value">{{ formData.category }}</span>
              <span v-else class="placeholder">选择分类</span>
              <AppIcon class="arrow" name="chevronDown" :size="12" />
            </div>
            <div class="select-dropdown">
              <div
                class="select-option"
                :class="{ active: formData.category === cat.name }"
                v-for="cat in categories"
                :key="cat.id"
                @click.stop="selectCategory(cat.name)"
              >
                {{ cat.name }}
              </div>
            </div>
          </div>
          <button type="button" class="btn-add-category" @click="showCustomCategory = true" title="添加自定义分类">
            <AppIcon name="addSite" :size="16" />
          </button>
        </div>
        <div v-else class="custom-category-group">
          <input v-model="customCategoryInput" type="text" placeholder="输入新分类名称" @keyup.enter="addCustomCategory" />
          <button type="button" class="btn-confirm" @click="addCustomCategory">
            ✓
          </button>
          <button type="button" class="btn-cancel-category" @click="showCustomCategory = false; customCategoryInput = ''">
            ✕
          </button>
        </div>
      </div>

      <div class="form-group">
        <label>描述</label>
        <textarea v-model="formData.description" rows="3" placeholder="简短描述该站点"></textarea>
      </div>

      <div class="form-group">
        <label>排序权重（数字越大越靠前）</label>
        <div class="sort-control">
          <button type="button" class="btn-sort" @click="formData.sort = Math.max(0, (formData.sort || 0) - 10)">
            <AppIcon name="minus" :size="16" />
          </button>
          <input v-model.number="formData.sort" type="number" readonly />
          <button type="button" class="btn-sort" @click="formData.sort = (formData.sort || 0) + 10">
            <AppIcon name="addSite" :size="16" />
          </button>
        </div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn-cancel" @click="$emit('cancel')">取消</button>
        <button type="submit" class="btn-save" :disabled="duplicateChecking || Boolean(duplicateMessage)">
          {{ duplicateChecking ? '检测中...' : '保存' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import type { Site } from '@/stores/sites'
import { usePrivacyStore } from '@/stores/privacy'
import AppIcon from '@/components/common/AppIcon.vue'

interface Props {
  site?: Site | null
  defaultCategory?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  save: [data: Site]
  cancel: []
}>()

const privacyStore = usePrivacyStore()

const isEdit = computed(() => !!props.site?.id)

const formData = ref<Site>({
  name: props.site?.name || '',
  url: props.site?.url || '',
  icon: props.site?.icon || '',
  category: props.site?.category || props.defaultCategory || '',
  description: props.site?.description || '',
  sort: props.site?.sort || 0
})

const extracting = ref(false)
const extractError = ref('')
const extractSuccess = ref(false)
const duplicateChecking = ref(false)
const duplicateMessage = ref('')
let duplicateTimer: ReturnType<typeof setTimeout> | null = null
let duplicateRequestId = 0

// 图标选项列表
interface IconOption {
  label: string
  url: string
  error?: boolean
}

const iconOptions = ref<IconOption[]>([])

// 生成图标选项
function generateIconOptions(extractedIcon?: string) {
  if (!formData.value.url) return

  try {
    const urlObj = new URL(formData.value.url)
    const domain = urlObj.hostname
    const origin = urlObj.origin

    const options: IconOption[] = []

    // 1. 提取的图标（如果有）
    if (extractedIcon) {
      options.push({
        label: '网站原图标',
        url: extractedIcon
      })

      // 2. 代理版本
      options.push({
        label: '代理加载',
        url: `/api/icon-proxy?url=${encodeURIComponent(extractedIcon)}`
      })
    }

    // 3. 默认 favicon.ico
    options.push({
      label: 'Favicon.ico',
      url: `${origin}/favicon.ico`
    })

    // 4. Google Favicon API
    options.push({
      label: 'Google API',
      url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    })

    iconOptions.value = options
  } catch (error) {
    console.error('生成图标选项失败:', error)
  }
}

// 选择图标方案
function selectIconOption(url: string) {
  formData.value.icon = url
}

// 处理选项图标加载错误
function handleOptionIconError(index: number) {
  iconOptions.value[index].error = true
}

// 分类管理
const categories = ref<Array<{ id: number; name: string; sort: number }>>([])
const showCustomCategory = ref(false)
const customCategoryInput = ref('')
const dropdownOpen = ref(false)

// 选择分类
function selectCategory(name: string) {
  formData.value.category = name
  dropdownOpen.value = false
}

// 点击外部关闭下拉框
const vClickOutside = {
  mounted(el: any, binding: any) {
    el.clickOutsideEvent = (event: Event) => {
      if (!(el === event.target || el.contains(event.target as Node))) {
        binding.value()
      }
    }
    document.addEventListener('click', el.clickOutsideEvent)
  },
  unmounted(el: any) {
    document.removeEventListener('click', el.clickOutsideEvent)
  }
}

// 加载分类列表
async function fetchCategories() {
  try {
      const response = await fetch('/api/categories', {
        headers: privacyStore.privacyHeaders()
      })
    const data = await response.json() as {
      success: boolean
      categories?: Array<{ id: number; name: string; sort: number }>
    }
    if (data.success && data.categories) {
      categories.value = data.categories
    }
  } catch (error) {
    console.error('Failed to fetch categories:', error)
  }
}

// 添加自定义分类
async function addCustomCategory() {
  if (!customCategoryInput.value.trim()) return

  try {
    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...privacyStore.privacyHeaders()
      },
      body: JSON.stringify({ name: customCategoryInput.value.trim() })
    })

    const data = await response.json() as {
      success: boolean
      category?: { id: number; name: string; sort: number }
      error?: string
    }

    if (data.success && data.category) {
      // 添加到本地列表
      categories.value.push(data.category)
      // 设置为当前选中
      formData.value.category = data.category.name
      // 重置状态
      showCustomCategory.value = false
      customCategoryInput.value = ''
    } else {
      alert(data.error || '添加分类失败')
    }
  } catch (error) {
    alert('网络错误，请重试')
  }
}

onMounted(() => {
  fetchCategories()
})

onBeforeUnmount(() => {
  if (duplicateTimer) {
    clearTimeout(duplicateTimer)
  }
})

watch(() => formData.value.url, () => {
  duplicateMessage.value = ''
  if (duplicateTimer) {
    clearTimeout(duplicateTimer)
  }

  if (!formData.value.url.trim()) return

  duplicateTimer = setTimeout(() => {
    checkDuplicateUrl()
  }, 450)
})

function normalizeSiteUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function duplicateText(source?: string | null) {
  if (source === 'submission') return '该站点已在推荐审核列表中'
  return '该站点已存在，不能重复添加'
}

async function checkDuplicateUrl(force = false) {
  const url = normalizeSiteUrl(formData.value.url)
  if (!url) {
    duplicateMessage.value = ''
    return false
  }

  const requestId = ++duplicateRequestId
  duplicateChecking.value = true

  try {
    const params = new URLSearchParams({ url })
    if (props.site?.id) {
      params.set('excludeId', String(props.site.id))
    }

    const response = await fetch(`/api/sites/check-url?${params.toString()}`, {
      headers: privacyStore.privacyHeaders()
    })
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
  if (!formData.value.url) {
    extractError.value = '请先输入站点链接'
    return
  }

  const duplicated = await checkDuplicateUrl(true)
  if (duplicated) return

  extracting.value = true
  extractError.value = ''
  extractSuccess.value = false

  try {
    const response = await fetch('/api/sites/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: formData.value.url })
    })

    const data = await response.json() as {
      success: boolean
      info?: {
        title?: string
        description?: string
        icon?: string
      }
      error?: string
    }

    if (data.success && data.info) {
      // 只填充空字段，不覆盖已有内容
      if (!formData.value.name && data.info.title) {
        formData.value.name = data.info.title
      }
      if (!formData.value.description && data.info.description) {
        formData.value.description = data.info.description
      }
      if (!formData.value.icon && data.info.icon) {
        formData.value.icon = data.info.icon
      }

      // 生成图标选项
      generateIconOptions(data.info.icon)

      extractSuccess.value = true
      setTimeout(() => {
        extractSuccess.value = false
      }, 3000)
    } else {
      // 提取失败，至少填充基础信息
      if (!formData.value.name) {
        const urlObj = new URL(formData.value.url)
        formData.value.name = urlObj.hostname
      }

      // 生成图标选项（无提取图标）
      generateIconOptions()

      if (!formData.value.icon) {
        const urlObj = new URL(formData.value.url)
        formData.value.icon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`
      }
      extractError.value = data.error || '自动提取失败，已填充基础信息'
    }
  } catch (error) {
    extractError.value = '网络错误，请手动填写'
  } finally {
    extracting.value = false
  }
}

async function handleSubmit() {
  formData.value.name = formData.value.name.trim()
  formData.value.url = normalizeSiteUrl(formData.value.url)
  formData.value.icon = formData.value.icon?.trim() || ''
  formData.value.description = formData.value.description?.trim() || ''

  // 验证必填字段
  if (!formData.value.category) {
    alert('请选择或添加一个分类')
    return
  }

  if (!formData.value.name || !formData.value.url) {
    alert('请填写站点名称和 URL')
    return
  }

  const duplicated = await checkDuplicateUrl(true)
  if (duplicated) return

  emit('save', formData.value)
}

</script>

<style scoped>
.site-editor {
  padding: var(--spacing-xl);
}

.site-editor h2 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: var(--spacing-lg);
}

.form-group {
  margin-bottom: var(--spacing-lg);
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: var(--spacing-sm);
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: var(--spacing-md);
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-md);
  font-size: 14px;
  transition: border-color var(--transition-fast);
  background: white;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  border-color: var(--primary-color);
}

.form-group textarea {
  resize: vertical;
  font-family: inherit;
}

.icon-options {
  margin-top: var(--spacing-sm);
}

.icon-options label {
  display: block;
  margin-bottom: var(--spacing-xs);
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.icon-options-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--spacing-sm);
}

.icon-option-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-md);
  background: white;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.icon-option-btn:hover {
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.icon-option-btn.active {
  border-color: var(--primary-color);
  background: rgba(102, 126, 234, 0.1);
}

.icon-option-btn.error {
  opacity: 0.5;
}

.icon-option-preview {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.icon-option-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.icon-placeholder-small {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.05);
  color: #999;
  font-size: 20px;
  border-radius: var(--radius-sm);
}

.icon-option-btn span {
  font-size: 12px;
  color: #1f2937;
  font-weight: 500;
  text-align: center;
}

.icon-preview {
  margin-top: var(--spacing-sm);
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.icon-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.icon-options {
  margin-top: var(--spacing-xs);
}

.url-input-group {
  display: flex;
  gap: var(--spacing-sm);
}

.url-input-group input {
  flex: 1;
}

.btn-extract {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--primary-color);
  color: white;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  transition: opacity var(--transition-fast);
}

.btn-extract:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-extract:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.extract-error {
  margin-top: var(--spacing-sm);
  font-size: 13px;
  color: #ef4444;
}

.extract-success {
  margin-top: var(--spacing-sm);
  font-size: 13px;
  color: #10b981;
}

.duplicate-checking {
  margin-top: var(--spacing-sm);
  font-size: 13px;
  color: #6b7280;
}

.sort-control {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.sort-control input {
  flex: 1;
  text-align: center;
  font-weight: 600;
  font-size: 16px;
  cursor: default;
}

.btn-sort {
  width: 40px;
  height: 40px;
  padding: var(--spacing-sm);
  background: var(--primary-color);
  color: white;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity var(--transition-fast);
  flex-shrink: 0;
}

.btn-sort:hover {
  opacity: 0.9;
}

.btn-sort:active {
  transform: scale(0.95);
}

.category-select-group {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.custom-select {
  flex: 1;
  position: relative;
  cursor: pointer;
  user-select: none;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-md);
  background: white;
  transition: all var(--transition-fast);
}

.custom-select:hover .select-trigger {
  border-color: rgba(102, 126, 234, 0.3);
}

.custom-select.open .select-trigger {
  border-color: var(--primary-color);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.selected-value {
  font-size: 14px;
  color: #333;
}

.placeholder {
  font-size: 14px;
  color: #999;
}

.arrow {
  transition: transform var(--transition-fast);
  flex-shrink: 0;
  margin-left: var(--spacing-sm);
}

.custom-select.open .arrow {
  transform: rotate(180deg);
}

.select-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 2px solid var(--primary-color);
  border-top: none;
  border-bottom-left-radius: var(--radius-md);
  border-bottom-right-radius: var(--radius-md);
  max-height: 240px;
  overflow-y: auto;
  z-index: 100;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-10px);
  transition: all var(--transition-fast);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.custom-select.open .select-dropdown {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.select-option {
  padding: var(--spacing-md);
  font-size: 14px;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.select-option:hover {
  background: rgba(102, 126, 234, 0.1);
}

.select-option.active {
  background: rgba(102, 126, 234, 0.15);
  color: var(--primary-color);
  font-weight: 600;
}

.select-option:last-child {
  border-bottom-left-radius: calc(var(--radius-md) - 2px);
  border-bottom-right-radius: calc(var(--radius-md) - 2px);
}

.btn-add-category {
  width: 40px;
  height: 40px;
  padding: var(--spacing-sm);
  background: #10b981;
  color: white;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity var(--transition-fast);
  flex-shrink: 0;
}

.btn-add-category:hover {
  opacity: 0.9;
}

.custom-category-group {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.custom-category-group input {
  flex: 1;
}

.btn-confirm,
.btn-cancel-category {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  transition: opacity var(--transition-fast);
  flex-shrink: 0;
}

.btn-confirm {
  background: #10b981;
  color: white;
}

.btn-cancel-category {
  background: #ef4444;
  color: white;
}

.btn-confirm:hover,
.btn-cancel-category:hover {
  opacity: 0.9;
}

.form-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
  padding-top: var(--spacing-md);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.btn-cancel,
.btn-save {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  transition: all var(--transition-fast);
}

.btn-cancel {
  background: rgba(0, 0, 0, 0.05);
}

.btn-cancel:hover {
  background: rgba(0, 0, 0, 0.1);
}

.btn-save {
  background: var(--primary-color);
  color: white;
}

.btn-save:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
