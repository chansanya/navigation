<template>
  <div class="bookmark-modal-overlay" @click.self="$emit('close')">
    <div class="bookmark-modal">
      <header class="modal-header">
        <h2>导入 Google 书签</h2>
        <button class="btn-close" type="button" @click="$emit('close')">✕</button>
      </header>

      <div class="modal-content">
        <section class="upload-zone">
          <label class="file-picker">
            <input type="file" accept=".html,.htm,text/html" @change="handleFileChange" />
            <span>选择 bookmarks.html</span>
          </label>
          <p v-if="fileName" class="file-name">{{ fileName }}</p>
          <p class="hint">支持 Chrome / Google 导出的 Netscape Bookmark HTML。导入时会自动创建新分类，并跳过 javascript、mailto 等非网页地址。</p>
        </section>

        <div v-if="parseError" class="error-state">{{ parseError }}</div>

        <section v-if="bookmarks.length > 0" class="summary-bar">
          <div class="summary-item">
            <strong>{{ bookmarks.length }}</strong>
            <span>个可导入地址</span>
          </div>
          <div class="summary-item summary-duplicates">
            <div class="summary-text">
              <strong>{{ existingCount }}</strong>
              <span>个已存在</span>
            </div>
            <button
              type="button"
              class="btn-remove-duplicates"
              :disabled="existingCount === 0"
              @click="removeExistingBookmarks"
            >
              剔除重复
            </button>
          </div>
          <div class="summary-item">
            <strong>{{ selectedCount }}</strong>
            <span>个待录入</span>
          </div>
        </section>

        <section v-if="bookmarks.length > 0" class="filter-bar">
          <label class="filter-search">
            <span>搜索</span>
            <input
              v-model="filterKeyword"
              type="search"
              placeholder="名称、URL、分类"
              autocomplete="off"
            />
          </label>
          <label>
            <span>分类</span>
            <select v-model="filterCategory">
              <option value="">全部分类</option>
              <option v-for="category in categoryOptions" :key="category" :value="category">{{ category }}</option>
            </select>
          </label>
          <label>
            <span>状态</span>
            <select v-model="filterStatus">
              <option value="all">全部</option>
              <option value="pending">待录入</option>
              <option value="existing">已存在</option>
              <option value="selected">已选择</option>
              <option value="unselected">未选择</option>
            </select>
          </label>
          <label>
            <span>每页</span>
            <select v-model.number="pageSize">
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </label>
          <button type="button" class="btn-clear-filters" :disabled="!hasActiveFilters" @click="clearFilters">
            清空
          </button>
          <span class="filter-count">显示 {{ pageDisplayStart }}-{{ pageEnd }} / {{ filteredBookmarks.length }}</span>
        </section>

        <section v-if="bookmarks.length > 0" class="bulk-actions">
          <label>
            <input type="checkbox" :checked="allPageImportableSelected" @change="toggleSelectAll" />
            <span>全选本页可导入项</span>
          </label>
          <div class="bulk-category">
            <span>批量分类</span>
            <select v-model="bulkCategory">
              <option value="">不修改</option>
              <option v-for="category in categoryOptions" :key="category" :value="category">{{ category }}</option>
            </select>
            <button type="button" :disabled="!bulkCategory" @click="applyBulkCategory">应用</button>
          </div>
        </section>

        <div v-if="bookmarks.length > 0" class="bookmark-list">
          <article
            v-for="bookmark in pagedBookmarks"
            :key="bookmark.id"
            class="bookmark-item"
            :class="{ selected: bookmark.selected, imported: bookmark.exists }"
          >
            <input
              type="checkbox"
              :checked="bookmark.selected || bookmark.exists"
              :disabled="bookmark.exists"
              @change="toggleBookmark(bookmark)"
            />
            <div class="bookmark-icon">
              <img
                v-if="bookmark.icon && !failedIconIds.has(bookmark.id)"
                :src="bookmark.icon"
                :alt="bookmark.name"
                @error="markIconFailed(bookmark.id)"
              />
              <span v-else>{{ getInitial(bookmark.name) }}</span>
            </div>
            <div class="bookmark-info">
              <div class="bookmark-title-row">
                <span class="bookmark-title">{{ bookmark.name }}</span>
                <span v-if="bookmark.exists" class="status-badge">已存在</span>
              </div>
              <div class="bookmark-url">{{ bookmark.url }}</div>
              <label class="category-field">
                <span>分类</span>
                <select v-model="bookmark.category" :disabled="bookmark.exists">
                  <option v-for="category in categoryOptions" :key="category" :value="category">
                    {{ category }}
                  </option>
                </select>
              </label>
            </div>
          </article>
        </div>

        <nav v-if="filteredBookmarks.length > 0" class="pagination" aria-label="书签分页">
          <button type="button" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">上一页</button>
          <button
            v-for="page in visiblePages"
            :key="page"
            type="button"
            :class="{ active: page === currentPage }"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
          <button type="button" :disabled="currentPage >= pageCount" @click="goToPage(currentPage + 1)">下一页</button>
        </nav>

        <div v-if="bookmarks.length > 0 && filteredBookmarks.length === 0" class="empty-state">
          没有匹配的书签
        </div>

        <div v-else-if="fileName && bookmarks.length === 0 && !parseError" class="empty-state">
          未解析到可导入的网址
        </div>
      </div>

      <footer class="modal-footer">
        <button class="btn-cancel" type="button" @click="$emit('close')">取消</button>
        <button class="btn-import" type="button" :disabled="selectedCount === 0 || importing" @click="handleImport">
          {{ importing ? '导入中...' : `导入 ${selectedCount} 个书签` }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSitesStore } from '@/stores/sites'
import type { Category, Site } from '@/stores/sites'

interface ParsedBookmark {
  id: string
  name: string
  url: string
  normalizedUrl: string
  icon: string
  category: string
  selected: boolean
  exists: boolean
}

const emit = defineEmits<{
  close: []
  imported: []
}>()

const sitesStore = useSitesStore()
const fileName = ref('')
const bookmarks = ref<ParsedBookmark[]>([])
const parseError = ref('')
const importing = ref(false)
const existingSiteUrls = ref<Set<string>>(new Set())
const failedIconIds = ref<Set<string>>(new Set())
const bulkCategory = ref('')
const filterKeyword = ref('')
const filterCategory = ref('')
const filterStatus = ref<'all' | 'pending' | 'existing' | 'selected' | 'unselected'>('all')
const currentPage = ref(1)
const pageSize = ref(20)

const existingCount = computed(() => bookmarks.value.filter((bookmark) => bookmark.exists).length)
const selectedCount = computed(() => bookmarks.value.filter((bookmark) => bookmark.selected && !bookmark.exists).length)
const pageImportableBookmarks = computed(() => pagedBookmarks.value.filter((bookmark) => !bookmark.exists))
const allPageImportableSelected = computed(() => (
  pageImportableBookmarks.value.length > 0 &&
  pageImportableBookmarks.value.every((bookmark) => bookmark.selected)
))
const hasActiveFilters = computed(() => Boolean(
  filterKeyword.value.trim() ||
  filterCategory.value ||
  filterStatus.value !== 'all'
))

const filteredBookmarks = computed(() => {
  const keyword = filterKeyword.value.trim().toLowerCase()

  // 所有筛选都只影响当前预览列表，不改变原始解析结果和选择状态。
  return bookmarks.value.filter((bookmark) => {
    if (filterCategory.value && bookmark.category !== filterCategory.value) return false

    if (filterStatus.value === 'pending' && bookmark.exists) return false
    if (filterStatus.value === 'existing' && !bookmark.exists) return false
    if (filterStatus.value === 'selected' && (!bookmark.selected || bookmark.exists)) return false
    if (filterStatus.value === 'unselected' && (bookmark.selected || bookmark.exists)) return false

    if (!keyword) return true

    return [
      bookmark.name,
      bookmark.url,
      bookmark.category
    ].join(' ').toLowerCase().includes(keyword)
  })
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredBookmarks.value.length / pageSize.value)))
const pageStart = computed(() => filteredBookmarks.value.length === 0 ? 0 : (currentPage.value - 1) * pageSize.value)
const pageDisplayStart = computed(() => filteredBookmarks.value.length === 0 ? 0 : pageStart.value + 1)
const pageEnd = computed(() => Math.min(pageStart.value + pageSize.value, filteredBookmarks.value.length))
const pagedBookmarks = computed(() => filteredBookmarks.value.slice(pageStart.value, pageEnd.value))
const visiblePages = computed(() => {
  const pages: number[] = []
  const start = Math.max(1, currentPage.value - 2)
  const end = Math.min(pageCount.value, start + 4)
  const adjustedStart = Math.max(1, end - 4)

  for (let page = adjustedStart; page <= end; page += 1) {
    pages.push(page)
  }

  return pages
})

const categoryOptions = computed(() => {
  const names = new Set<string>()
  // 分类下拉同时包含数据库已有分类和书签文件里解析出的分类。
  sitesStore.categoryList.forEach((category: Category) => names.add(category.name))
  bookmarks.value.forEach((bookmark) => {
    if (bookmark.category) names.add(bookmark.category)
  })
  if (names.size === 0) names.add('其他')
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

function normalizeUrl(value: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) return ''

  try {
    const url = new URL(trimmedValue)
    url.hash = ''
    url.hostname = url.hostname.toLowerCase()
    // 查重时忽略默认端口和尾斜杠，与后端 URL 查重策略保持一致。
    if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) {
      url.port = ''
    }

    const normalized = url.toString()
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
  } catch {
    return trimmedValue.replace(/\/$/, '')
  }
}

function isWebUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function fallbackIcon(url: string) {
  try {
    const hostname = new URL(url).hostname
    return hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=128` : ''
  } catch {
    return ''
  }
}

function normalizeIcon(anchor: HTMLAnchorElement) {
  const iconUri = anchor.getAttribute('ICON_URI') || ''
  const icon = anchor.getAttribute('ICON') || ''
  const href = anchor.href

  // Chrome 导出的 ICON 可能是 data URI，也可能给 ICON_URI；优先使用可直接展示的图标。
  if (iconUri && /^https?:\/\//i.test(iconUri)) return iconUri
  if (icon && icon.startsWith('data:image/')) return icon
  if (icon && /^https?:\/\//i.test(icon)) return icon

  return fallbackIcon(href)
}

function getDirectChild(element: Element, tagName: string) {
  return Array.from(element.children).find((child) => child.tagName.toLowerCase() === tagName)
}

function getSiblingList(element: Element) {
  // Netscape Bookmark HTML 有时把 H3 后面的 DL 作为兄弟节点而不是子节点。
  let sibling = element.nextElementSibling
  while (sibling) {
    if (sibling.tagName.toLowerCase() === 'dl') return sibling
    if (sibling.tagName.toLowerCase() === 'dt') return null
    sibling = sibling.nextElementSibling
  }
  return null
}

function walkBookmarkList(list: Element, categoryPath: string[], output: ParsedBookmark[]) {
  // 递归遍历 DL/DT 结构，当前路径最后一级作为导入分类。
  Array.from(list.children).forEach((child) => {
    if (child.tagName.toLowerCase() !== 'dt') return

    const anchor = getDirectChild(child, 'a') as HTMLAnchorElement | undefined
    if (anchor) {
      const url = anchor.href
      // 跳过 javascript、mailto 等非网页地址。
      if (!isWebUrl(url)) return

      const normalizedUrl = normalizeUrl(url)
      if (!normalizedUrl) return
      const category = categoryPath[categoryPath.length - 1] || '其他'
      const exists = existingSiteUrls.value.has(normalizedUrl)

      output.push({
        id: `${output.length}-${normalizedUrl}`,
        name: anchor.textContent?.trim() || new URL(url).hostname,
        url,
        normalizedUrl,
        icon: normalizeIcon(anchor),
        category,
        selected: !exists,
        exists
      })
      return
    }

    const heading = getDirectChild(child, 'h3')
    if (!heading) return

    const categoryName = heading.textContent?.trim() || '其他'
    const nestedList = getDirectChild(child, 'dl') || getSiblingList(child)
    if (nestedList) {
      walkBookmarkList(nestedList, [...categoryPath, categoryName], output)
    }
  })
}

function parseBookmarks(html: string) {
  // Chrome/Google 使用 Netscape Bookmark HTML，根节点通常是 body > dl。
  const document = new DOMParser().parseFromString(html, 'text/html')
  const rootList = document.querySelector('body > dl') || document.querySelector('dl')
  if (!rootList) {
    throw new Error('未找到书签列表')
  }

  const parsed: ParsedBookmark[] = []
  walkBookmarkList(rootList, [], parsed)
  return parsed
}

async function fetchExistingSites() {
  // 导入前先拉取现有站点，用归一化 URL 标记重复项。
  await sitesStore.fetchSites()
  existingSiteUrls.value = new Set(
    sitesStore.sites
      .map((site: Site) => normalizeUrl(site.url))
      .filter(Boolean)
  )
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  fileName.value = file.name
  parseError.value = ''
  failedIconIds.value = new Set()

  try {
    await fetchExistingSites()
    // 文件只在浏览器本地解析，解析完成后再由用户确认导入。
    const html = await file.text()
    bookmarks.value = parseBookmarks(html)
    currentPage.value = 1
  } catch (error) {
    bookmarks.value = []
    parseError.value = error instanceof Error ? error.message : '解析书签失败'
  }
}

function toggleSelectAll() {
  const nextSelected = !allPageImportableSelected.value
  pagedBookmarks.value.forEach((bookmark) => {
    if (!bookmark.exists) {
      bookmark.selected = nextSelected
    }
  })
}

function toggleBookmark(bookmark: ParsedBookmark) {
  if (bookmark.exists) return
  bookmark.selected = !bookmark.selected
}

function applyBulkCategory() {
  if (!bulkCategory.value) return
  pagedBookmarks.value.forEach((bookmark) => {
    if (bookmark.selected && !bookmark.exists) {
      bookmark.category = bulkCategory.value
    }
  })
}

function removeExistingBookmarks() {
  if (existingCount.value === 0) return

  // 剔除重复项时同步清理图标失败缓存，避免残留无效 id。
  const existingIds = new Set(
    bookmarks.value
      .filter((bookmark) => bookmark.exists)
      .map((bookmark) => bookmark.id)
  )

  bookmarks.value = bookmarks.value.filter((bookmark) => !bookmark.exists)
  failedIconIds.value = new Set(
    Array.from(failedIconIds.value).filter((id) => !existingIds.has(id))
  )
  currentPage.value = Math.min(currentPage.value, pageCount.value)
}

function clearFilters() {
  filterKeyword.value = ''
  filterCategory.value = ''
  filterStatus.value = 'all'
  currentPage.value = 1
}

function goToPage(page: number) {
  currentPage.value = Math.min(Math.max(page, 1), pageCount.value)
}

function markIconFailed(id: string) {
  failedIconIds.value = new Set([...failedIconIds.value, id])
}

function getInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || '?'
}

async function ensureCategories(categories: string[]) {
  await sitesStore.fetchCategories()
  const existingNames = new Set(sitesStore.categoryList.map((category: Category) => category.name))

  // 书签 HTML 中出现但数据库不存在的分类，导入前自动补齐。
  for (const category of categories) {
    if (!category || existingNames.has(category)) continue
    const created = await sitesStore.createCategory(category)
    if (created) {
      existingNames.add(category)
    }
  }
}

async function handleImport() {
  const selectedItems = bookmarks.value.filter((bookmark) => bookmark.selected && !bookmark.exists)
  if (selectedItems.length === 0) return

  importing.value = true

  try {
    await ensureCategories(Array.from(new Set(selectedItems.map((bookmark) => bookmark.category))))

    // 逐条调用站点创建 API，让后端重复 URL 和隐私分类校验继续生效。
    for (const bookmark of selectedItems) {
      await sitesStore.createSite({
        name: bookmark.name,
        url: bookmark.url,
        icon: bookmark.icon || fallbackIcon(bookmark.url),
        category: bookmark.category || '其他',
        description: '',
        sort: 0
      })
    }

    emit('imported')
    emit('close')
  } catch (error) {
    alert('导入失败，请重试')
  } finally {
    importing.value = false
  }
}

onMounted(() => {
  fetchExistingSites()
  sitesStore.fetchCategories()
})

watch([filterKeyword, filterCategory, filterStatus, pageSize], () => {
  currentPage.value = 1
})

watch(pageCount, () => {
  if (currentPage.value > pageCount.value) {
    currentPage.value = pageCount.value
  }
})
</script>

<style scoped>
.bookmark-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  padding: var(--spacing-lg);
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.bookmark-modal {
  width: min(100%, 920px);
  max-height: 86vh;
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.24);
  display: flex;
  flex-direction: column;
}

.modal-header,
.modal-footer {
  padding: var(--spacing-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.modal-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.modal-header h2 {
  font-size: 20px;
  font-weight: 600;
}

.btn-close {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  font-size: 20px;
}

.btn-close:hover {
  background: rgba(0, 0, 0, 0.08);
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
}

.upload-zone {
  padding: var(--spacing-md);
  border: 1px dashed rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.02);
}

.file-picker input {
  display: none;
}

.file-picker span {
  height: 38px;
  padding: 0 var(--spacing-lg);
  border-radius: var(--radius-md);
  background: var(--primary-color);
  color: white;
  display: inline-flex;
  align-items: center;
  font-weight: 600;
  cursor: pointer;
}

.file-name,
.hint {
  margin-top: var(--spacing-sm);
  font-size: 13px;
  opacity: 0.72;
}

.error-state,
.empty-state {
  margin-top: var(--spacing-md);
  padding: var(--spacing-lg);
  text-align: center;
  color: #ef4444;
}

.summary-bar {
  margin: var(--spacing-md) 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
}

.summary-item {
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background: rgba(102, 126, 234, 0.08);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.summary-duplicates {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.summary-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.summary-bar strong {
  font-size: 20px;
}

.summary-bar span {
  font-size: 12px;
  opacity: 0.72;
}

.filter-bar {
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(255, 255, 255, 0.9));
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(128px, auto) minmax(118px, auto) minmax(92px, auto) auto auto;
  align-items: end;
  gap: var(--spacing-sm);
}

.filter-bar label {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: rgba(0, 0, 0, 0.62);
  font-size: 12px;
  font-weight: 600;
}

.filter-search input {
  width: 100%;
  height: 36px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: var(--radius-sm);
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.92);
  color: rgba(0, 0, 0, 0.86);
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.filter-search input:focus {
  border-color: color-mix(in srgb, var(--primary-color) 68%, transparent);
  background: white;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 14%, transparent);
}

.filter-count {
  justify-self: end;
  padding-bottom: 9px;
  color: rgba(0, 0, 0, 0.54);
  font-size: 12px;
  white-space: nowrap;
}

.btn-clear-filters {
  height: 36px;
  padding: 0 var(--spacing-md);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.72);
  font-weight: 600;
}

.btn-clear-filters:not(:disabled):hover {
  background: rgba(0, 0, 0, 0.1);
}

.btn-clear-filters:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.bulk-actions {
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.03);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.bulk-actions label,
.bulk-category {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.btn-remove-duplicates {
  height: 34px;
  padding: 0 var(--spacing-md);
  border-radius: var(--radius-sm);
  background: rgba(239, 68, 68, 0.1);
  color: #b91c1c;
  font-weight: 600;
  white-space: nowrap;
}

.btn-remove-duplicates:not(:disabled):hover {
  background: rgba(239, 68, 68, 0.16);
}

.btn-remove-duplicates:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.bulk-category select,
.category-field select,
.filter-bar select {
  height: 34px;
  min-width: 140px;
  border: 1px solid rgba(0, 0, 0, 0.14);
  border-radius: var(--radius-sm);
  padding: 0 34px 0 12px;
  appearance: none;
  background:
    linear-gradient(45deg, transparent 50%, rgba(0, 0, 0, 0.56) 50%) right 16px center / 6px 6px no-repeat,
    linear-gradient(135deg, rgba(0, 0, 0, 0.56) 50%, transparent 50%) right 10px center / 6px 6px no-repeat,
    rgba(255, 255, 255, 0.94);
  color: rgba(0, 0, 0, 0.82);
  font: inherit;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.filter-bar select {
  width: 100%;
  height: 36px;
  min-width: 0;
}

.bulk-category select:hover,
.category-field select:hover,
.filter-bar select:hover {
  border-color: rgba(0, 0, 0, 0.24);
  background-color: white;
}

.bulk-category select:focus,
.category-field select:focus,
.filter-bar select:focus {
  border-color: color-mix(in srgb, var(--primary-color) 68%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 14%, transparent);
  background-color: white;
}

.bulk-category select:disabled,
.category-field select:disabled,
.filter-bar select:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}

.bulk-category button {
  height: 34px;
  padding: 0 var(--spacing-md);
  border-radius: var(--radius-sm);
  background: var(--primary-color);
  color: white;
}

.bulk-category button:disabled {
  opacity: 0.5;
}

.bookmark-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.bookmark-item {
  display: grid;
  grid-template-columns: auto 42px 1fr;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: var(--radius-md);
  background: white;
}

.bookmark-item.selected {
  border-color: color-mix(in srgb, var(--primary-color) 64%, transparent);
  background: color-mix(in srgb, var(--primary-color) 7%, white);
}

.bookmark-item.imported {
  opacity: 0.66;
}

.bookmark-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.06);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-weight: 700;
}

.bookmark-icon img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.bookmark-info {
  min-width: 0;
}

.bookmark-title-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.bookmark-title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: #10b981;
  color: white;
  font-size: 12px;
}

.bookmark-url {
  margin-top: 3px;
  font-size: 13px;
  opacity: 0.62;
  word-break: break-all;
}

.category-field {
  margin-top: var(--spacing-sm);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 13px;
}

.modal-footer {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  justify-content: flex-end;
}

.btn-cancel,
.btn-import {
  height: 38px;
  padding: 0 var(--spacing-lg);
  border-radius: var(--radius-md);
  font-weight: 600;
}

.btn-cancel {
  background: rgba(0, 0, 0, 0.06);
}

.btn-import {
  background: var(--primary-color);
  color: white;
}

.btn-import:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination {
  margin-top: var(--spacing-md);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}

.pagination button {
  min-width: 34px;
  height: 34px;
  padding: 0 11px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-sm);
  background: white;
  color: rgba(0, 0, 0, 0.72);
  font-weight: 600;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.pagination button:not(:disabled):hover {
  border-color: color-mix(in srgb, var(--primary-color) 48%, transparent);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.pagination button.active {
  border-color: color-mix(in srgb, var(--primary-color) 74%, transparent);
  background: var(--primary-color);
  color: white;
}

.pagination button:disabled {
  opacity: 0.44;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .bookmark-modal {
    max-height: 92vh;
  }

  .summary-bar {
    grid-template-columns: 1fr;
  }

  .summary-duplicates {
    align-items: flex-start;
    flex-direction: column;
  }

  .filter-bar {
    grid-template-columns: 1fr 1fr;
  }

  .filter-search,
  .filter-count {
    grid-column: 1 / -1;
  }

  .filter-count {
    justify-self: start;
    padding-bottom: 0;
  }

  .bulk-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .bookmark-item {
    grid-template-columns: auto 38px 1fr;
  }

  .category-field {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
