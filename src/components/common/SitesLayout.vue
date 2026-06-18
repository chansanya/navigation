<template>
  <div class="sites-layout">
    <!-- 左侧分类菜单 -->
    <div class="category-sidebar-wrap">
      <aside ref="categorySidebar" class="category-sidebar" @scroll="updateCategoryScrollHint">
        <div class="sidebar-header">
          <h2>分类</h2>
          <button
            v-if="canUseLocalCategoryHiding"
            class="btn-category-filter"
            type="button"
            title="筛选"
            @click="showHiddenCategoryModal = true"
          >
            <AppIcon name="filter" :size="16" />
          </button>
          <button v-if="showActions" class="btn-add-category" @click="handleAddCategory" title="新增分类">
            <AppIcon name="addSite" :size="16" />
          </button>
        </div>
        <nav class="category-nav" :class="{ 'is-reordering': isDraggingCategory }">
          <button
            v-for="(item, index) in visibleCategories"
            :key="item.category"
            class="category-item"
            :class="{
              active: !isSearching && currentCategory === item.category,
              'drop-target': dropTargetCategory === item.category,
              'dragging': draggingCategoryIndex === index,
              'drag-before': dropTargetIndex === index && draggingCategoryIndex !== null && draggingCategoryIndex > index,
              'drag-after': dropTargetIndex === index && draggingCategoryIndex !== null && draggingCategoryIndex < index,
              'sibling': isDraggingCategory && draggingCategoryIndex !== null && draggingCategoryIndex !== index
            }"
            :draggable="showActions"
            @click="handleSelectCategory(item.category)"
            @dragstart="handleCategoryDragStart(index, $event)"
            @dragend="handleCategoryDragEnd"
            @dragover.prevent="handleDragOver(item.category, index, $event)"
            @dragleave="handleDragLeave($event)"
            @drop="handleDrop(item.category, index, $event)"
          >
            <span class="category-name">{{ item.category }}</span>
            <span v-if="item.sites.length > 0" class="category-count">{{ item.sites.length }}</span>
            <button
              v-else-if="showActions"
              class="btn-delete-category"
              @click.stop="handleDeleteCategory(item.categoryId, item.category)"
              title="删除分类"
            >
              <AppIcon name="trash" :size="14" />
            </button>
          </button>
          <div v-if="visibleCategories.length === 0" class="category-empty">
            <span>分类已全部屏蔽</span>
            <button type="button" @click="clearHiddenCategories">恢复显示</button>
          </div>
        </nav>
      </aside>
      <button
        v-if="showCategoryScrollHint"
        type="button"
        class="category-scroll-hint"
        aria-label="查看更多分类"
        @click="scrollCategoryDown"
      >
        <AppIcon name="chevronDown" :size="16" />
      </button>
    </div>

    <!-- 右侧站点列表 -->
    <main class="sites-panel">
      <div class="panel-header">
        <div class="panel-title">
          <h2>{{ panelTitle }}</h2>
          <p class="site-count">
            {{ siteCountText }}
          </p>
        </div>
        <div class="panel-actions">
          <button
            v-if="canEdit"
            type="button"
            class="btn-panel-edit-mode"
            :class="{ active: showActions }"
            :title="showActions ? '退出编辑' : '编辑模式'"
            :aria-label="showActions ? '退出编辑' : '编辑模式'"
            @click="$emit('toggleEditMode')"
          >
            <AppIcon :name="showActions ? 'exitEdit' : 'editMode'" />
          </button>
          <button
            v-if="showPanelAddSite"
            type="button"
            class="btn-panel-add-site"
            title="新增站点"
            aria-label="新增站点"
            @click="handleAddSite"
          >
            <AppIcon name="addSite" />
          </button>
        </div>
      </div>
      <div class="sites-grid" :class="{ 'is-site-reordering': isDraggingSite }">
        <SiteCard
          v-for="(site, index) in currentSites"
          :key="site.id"
          :site="site"
          :show-actions="showActions"
          :show-category-badge="Boolean(normalizedSearchQuery)"
          :class="{
            'site-drop-before': siteDropTargetIndex === index && draggingSiteIndex !== null && draggingSiteIndex > index,
            'site-drop-after': siteDropTargetIndex === index && draggingSiteIndex !== null && draggingSiteIndex < index
          }"
          @edit="$emit('edit', site)"
          @delete="$emit('delete', site)"
          @drag-start="handleSiteDragStart"
          @drag-end="handleSiteDragEnd"
          @dragover.prevent="handleSiteDragOver(site, index, $event)"
          @dragleave="handleSiteDragLeave($event)"
          @drop="handleSiteDrop(index, $event)"
        />
      </div>
      <div v-if="currentSites.length === 0" class="empty-state">
        <p>{{ emptyMessage }}</p>
      </div>
    </main>

    <div v-if="showHiddenCategoryModal" class="modal-overlay" @click="showHiddenCategoryModal = false">
      <div class="modal-content category-visibility-modal" @click.stop>
        <h3>筛选</h3>

        <div class="visibility-list">
          <label
            v-for="category in props.categories"
            :key="category.category"
            class="visibility-item"
          >
            <input
              type="checkbox"
              :checked="!hiddenCategoryNames.has(category.category)"
              @change="toggleCategoryVisibility(category.category)"
            />
            <span>{{ category.category }}</span>
            <small>{{ category.sites.length }}</small>
          </label>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" type="button" @click="clearHiddenCategories">全部显示</button>
          <button class="btn-confirm" type="button" @click="showHiddenCategoryModal = false">完成</button>
        </div>
      </div>
    </div>

    <!-- 新增分类弹窗 -->
    <div v-if="showCategoryModal" class="modal-overlay" @click="showCategoryModal = false">
      <div class="modal-content" @click.stop>
        <h3>新增分类</h3>
        <input
          v-model="newCategoryName"
          type="text"
          placeholder="请输入分类名称"
          maxlength="20"
          @keyup.enter="confirmAddCategory"
          ref="categoryInput"
        />
        <div class="modal-actions">
          <button class="btn-cancel" @click="showCategoryModal = false">取消</button>
          <button class="btn-confirm" @click="confirmAddCategory" :disabled="!newCategoryName.trim()">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import type { Site } from '@/stores/sites'
import { useAuthStore } from '@/stores/auth'
import SiteCard from './SiteCard.vue'
import AppIcon from './AppIcon.vue'

interface CategoryItem {
  category: string
  categoryId?: number
  sort: number
  sites: Site[]
}

interface Props {
  categories: CategoryItem[]
  showActions?: boolean
  canEdit?: boolean
  searchQuery?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  edit: [site: Site]
  delete: [site: Site]
  changeCategory: [site: Site, newCategory: string]
  reorderCategory: [fromIndex: number, toIndex: number]
  reorderSite: [category: string, fromIndex: number, toIndex: number]
  addCategory: [name: string]
  addSite: [category: string]
  deleteCategory: [categoryId: number, categoryName: string]
  selectCategory: [category: string]
  toggleEditMode: []
}>()

const LOCAL_HIDDEN_CATEGORY_KEY = 'navigation-hidden-categories'
const authStore = useAuthStore()

// 新增分类弹窗
const showCategoryModal = ref(false)
const showHiddenCategoryModal = ref(false)
const newCategoryName = ref('')
const categoryInput = ref<HTMLInputElement>()
const categorySidebar = ref<HTMLElement>()
const showCategoryScrollHint = ref(false)
const hiddenCategoryNames = ref<Set<string>>(loadHiddenCategories())

// 当前选中的分类
const currentCategory = ref(props.categories[0]?.category || '')

// 当前分类的站点
const dropTargetCategory = ref('')

// 拖拽的分类索引
const draggingCategoryIndex = ref<number | null>(null)

// 拖拽悬停的目标位置索引（分类排序用）
const dropTargetIndex = ref<number | null>(null)

const draggingSiteId = ref<number | null>(null)
const draggingSiteCategory = ref('')
const siteDropTargetIndex = ref<number | null>(null)

// 是否正在拖拽分类
const isDraggingCategory = computed(() => draggingCategoryIndex.value !== null)
const isDraggingSite = computed(() => draggingSiteId.value !== null && !isSearching.value)
const draggingSiteIndex = computed(() => {
  if (draggingSiteId.value === null) return null
  const index = currentSites.value.findIndex((site) => site.id === draggingSiteId.value)
  return index >= 0 ? index : null
})

const normalizedSearchQuery = computed(() => (props.searchQuery || '').trim().toLowerCase())
const isSearching = computed(() => Boolean(normalizedSearchQuery.value))
const canUseLocalCategoryHiding = computed(() => !props.showActions && !authStore.isAuthenticated)
const visibleCategories = computed(() => {
  if (!canUseLocalCategoryHiding.value) return props.categories
  return props.categories.filter((category) => !hiddenCategoryNames.value.has(category.category))
})
const hiddenCount = computed(() => props.categories.length - visibleCategories.value.length)
const showPanelAddSite = computed(() => Boolean(authStore.isAuthenticated && !isSearching.value && currentCategory.value))
const panelTitle = computed(() => {
  if (isSearching.value) return '搜索结果'
  return currentCategory.value || '分类已屏蔽'
})
const siteCountText = computed(() => {
  const hiddenText = hiddenCount.value > 0 && canUseLocalCategoryHiding.value ? `，已屏蔽 ${hiddenCount.value} 个分类` : ''
  const prefix = normalizedSearchQuery.value ? `匹配 ${currentSites.value.length} 个站点` : `共 ${currentSites.value.length} 个站点`
  return `${prefix}${hiddenText}`
})
const emptyMessage = computed(() => {
  if (visibleCategories.value.length === 0 && props.categories.length > 0) {
    return '所有分类已在本机屏蔽，可在左侧恢复显示'
  }

  return normalizedSearchQuery.value ? '没有匹配的站点' : '该分类下暂无站点'
})

const currentSites = computed(() => {
  if (isSearching.value) {
    return visibleCategories.value
      .flatMap((category) => category.sites)
      .filter((site) => {
        const searchableText = `${site.name} ${site.description || ''}`.toLowerCase()
        return searchableText.includes(normalizedSearchQuery.value)
      })
      .sort((a, b) => (b.sort || 0) - (a.sort || 0))
  }

  const found = visibleCategories.value.find(c => c.category === currentCategory.value)
  return found?.sites || []
})

function loadHiddenCategories() {
  try {
    const rawValue = window.localStorage.getItem(LOCAL_HIDDEN_CATEGORY_KEY)
    const parsed = rawValue ? JSON.parse(rawValue) : []
    if (!Array.isArray(parsed)) return new Set<string>()

    return new Set(parsed.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())))
  } catch {
    return new Set<string>()
  }
}

function saveHiddenCategories() {
  window.localStorage.setItem(
    LOCAL_HIDDEN_CATEGORY_KEY,
    JSON.stringify(Array.from(hiddenCategoryNames.value))
  )
}

function toggleCategoryVisibility(category: string) {
  const nextHiddenCategories = new Set(hiddenCategoryNames.value)

  if (nextHiddenCategories.has(category)) {
    nextHiddenCategories.delete(category)
  } else {
    nextHiddenCategories.add(category)
  }

  hiddenCategoryNames.value = nextHiddenCategories
  saveHiddenCategories()
}

function clearHiddenCategories() {
  hiddenCategoryNames.value = new Set()
  saveHiddenCategories()
}

function updateCategoryScrollHint() {
  const el = categorySidebar.value
  if (!el) {
    showCategoryScrollHint.value = false
    return
  }

  const remainingScroll = el.scrollHeight - el.scrollTop - el.clientHeight
  showCategoryScrollHint.value = remainingScroll > 8
}

async function refreshCategoryScrollHint() {
  await nextTick()
  requestAnimationFrame(updateCategoryScrollHint)
}

function scrollCategoryDown() {
  categorySidebar.value?.scrollBy({
    top: 160,
    behavior: 'smooth'
  })
}

function handleSelectCategory(category: string) {
  currentCategory.value = category
}

function handleAddSite() {
  if (!currentCategory.value) return
  emit('addSite', currentCategory.value)
}

watch([() => props.categories, visibleCategories], () => {
  const categoryNames = new Set(props.categories.map((category) => category.category))
  const nextHiddenCategories = new Set(
    Array.from(hiddenCategoryNames.value).filter((category) => categoryNames.has(category))
  )

  if (nextHiddenCategories.size !== hiddenCategoryNames.value.size) {
    hiddenCategoryNames.value = nextHiddenCategories
    saveHiddenCategories()
  }

  if (!visibleCategories.value.some((category) => category.category === currentCategory.value)) {
    currentCategory.value = visibleCategories.value[0]?.category || ''
  }
  refreshCategoryScrollHint()
}, { deep: true, flush: 'post', immediate: true })

watch(currentCategory, (category) => {
  if (category) {
    emit('selectCategory', category)
  }
}, { immediate: true })

onMounted(() => {
  refreshCategoryScrollHint()
  window.addEventListener('resize', updateCategoryScrollHint)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateCategoryScrollHint)
})

// 拖拽分类开始
function handleCategoryDragStart(index: number, e: DragEvent) {
  if (!props.showActions) return

  draggingCategoryIndex.value = index
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', 'category') // 标记为分类拖拽
}

// 拖拽分类结束
function handleCategoryDragEnd() {
  draggingCategoryIndex.value = null
  dropTargetCategory.value = ''
  dropTargetIndex.value = null
}

// 拖拽悬停
function handleDragOver(category: string, index: number, e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }

  // 分类拖拽（调整顺序）：记录目标位置
  if (draggingCategoryIndex.value !== null) {
    if (draggingCategoryIndex.value !== index) {
      dropTargetIndex.value = index
      dropTargetCategory.value = ''
    } else {
      dropTargetIndex.value = null
    }
    return
  }

  // 站点拖拽（修改分类）
  dropTargetCategory.value = category
}

function handleSiteDragStart(site: Site) {
  if (!props.showActions || isSearching.value || !site.id) return
  draggingSiteId.value = site.id
  draggingSiteCategory.value = site.category || ''
}

function handleSiteDragEnd() {
  draggingSiteId.value = null
  draggingSiteCategory.value = ''
  siteDropTargetIndex.value = null
}

function handleSiteDragOver(site: Site, index: number, e: DragEvent) {
  if (!props.showActions || isSearching.value || draggingSiteId.value === null) return
  if (draggingSiteCategory.value !== currentCategory.value || site.category !== currentCategory.value) return

  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }

  siteDropTargetIndex.value = draggingSiteId.value === site.id ? null : index
}

function handleSiteDragLeave(e: DragEvent) {
  if (draggingSiteId.value === null) return

  const currentTarget = e.currentTarget as HTMLElement | null
  const relatedTarget = e.relatedTarget as Node | null
  if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
    return
  }

  siteDropTargetIndex.value = null
}

function handleSiteDrop(toIndex: number, e: DragEvent) {
  if (!props.showActions || isSearching.value || draggingSiteId.value === null) return

  e.preventDefault()
  const dataType = e.dataTransfer?.getData('text/plain')
  if (dataType !== 'site') return

  const fromIndex = draggingSiteIndex.value
  if (fromIndex !== null && fromIndex !== toIndex && draggingSiteCategory.value === currentCategory.value) {
    emit('reorderSite', currentCategory.value, fromIndex, toIndex)
  }

  handleSiteDragEnd()
}

// 拖拽离开
function handleDragLeave(e: DragEvent) {
  if (draggingCategoryIndex.value !== null) {
    return
  }

  const currentTarget = e.currentTarget as HTMLElement | null
  const relatedTarget = e.relatedTarget as Node | null
  if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
    return
  }

  dropTargetCategory.value = ''
  dropTargetIndex.value = null
}

// 拖放
function handleDrop(category: string, toIndex: number, e: DragEvent) {
  e.preventDefault()
  dropTargetCategory.value = ''
  dropTargetIndex.value = null

  const dataType = e.dataTransfer?.getData('text/plain')

  // 如果是分类拖拽（调整顺序）
  if (dataType === 'category' && draggingCategoryIndex.value !== null) {
    emit('reorderCategory', draggingCategoryIndex.value, toIndex)
    return
  }

  // 如果是站点拖拽（修改分类）
  try {
    const siteData = e.dataTransfer?.getData('application/json')
    if (!siteData) return

    const site = JSON.parse(siteData) as Site

    // 如果拖到同一个分类，不处理
    if (site.category === category) return

    // 触发分类修改事件
    emit('changeCategory', site, category)
  } catch (error) {
    console.error('拖放处理失败:', error)
  }
}

// 新增分类
function handleAddCategory() {
  showCategoryModal.value = true
  newCategoryName.value = ''
  // 下一帧聚焦输入框
  setTimeout(() => {
    categoryInput.value?.focus()
  }, 100)
}

// 确认新增分类
function confirmAddCategory() {
  const name = newCategoryName.value.trim()
  if (!name) return

  emit('addCategory', name)
  showCategoryModal.value = false
  newCategoryName.value = ''
}

// 删除分类
function handleDeleteCategory(categoryId: number | undefined, categoryName: string) {
  if (!categoryId) return
  emit('deleteCategory', categoryId, categoryName)
}
</script>

<style scoped>
.sites-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: var(--spacing-xl);
  /* 撑满可视区域，左右各自滚动 */
  height: calc(100vh - 160px);
}

/* 左侧分类导航：独立滚动 */
.category-sidebar-wrap {
  position: relative;
  min-height: 0;
  height: 100%;
}

.category-sidebar {
  background: var(--appearance-menu-bg);
  border: 1px solid color-mix(in srgb, var(--appearance-menu-border-color) 26%, transparent);
  color: var(--appearance-menu-text-color);
  border-radius: var(--radius-lg);
  height: 100%;
  padding: var(--spacing-lg) var(--spacing-lg) calc(var(--spacing-lg) + 36px);
  overflow-y: auto;
  /* 隐藏滚动条但保留滚动 */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.category-sidebar::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.category-scroll-hint {
  position: absolute;
  left: 50%;
  bottom: 12px;
  z-index: 2;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  background: rgba(255, 255, 255, 0.16);
  border: none;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);
  transform: translateX(-50%);
  transition: transform var(--transition-fast), background var(--transition-fast), opacity var(--transition-fast);
  animation: categoryHintFloat 1.6s ease-in-out infinite;
}

.category-scroll-hint:hover {
  background: rgba(255, 255, 255, 0.26);
  transform: translateX(-50%) translateY(1px);
}

@keyframes categoryHintFloat {
  0%,
  100% {
    translate: 0 0;
  }
  50% {
    translate: 0 4px;
  }
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  padding: 0 var(--spacing-sm);
}

.sidebar-header h2 {
  flex: 1;
  font-size: 14px;
  font-weight: var(--appearance-menu-font-weight);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.6;
}

.btn-category-filter,
.btn-add-category {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  color: var(--appearance-menu-text-color);
  background: transparent;
  opacity: 0.72;
}

.btn-category-filter:hover,
.btn-add-category:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--appearance-menu-text-color);
  opacity: 1;
  transform: scale(1.1);
}

.category-empty {
  padding: var(--spacing-md);
  border: 1px dashed color-mix(in srgb, var(--appearance-menu-border-color) 34%, transparent);
  border-radius: var(--radius-md);
  color: var(--appearance-menu-text-color);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  font-size: 13px;
  opacity: 0.82;
}

.category-empty button {
  width: fit-content;
  color: var(--appearance-menu-text-color);
  font-weight: var(--appearance-menu-font-weight);
  text-decoration: underline;
}

.category-nav {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.category-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border: 2px solid color-mix(in srgb, var(--appearance-menu-border-color) 28%, transparent);
  border-radius: var(--radius-md);
  text-align: left;
  transition: all var(--transition-fast);
  cursor: pointer;
  background: transparent;
  color: var(--appearance-menu-text-color);
  text-decoration: none;
  opacity: 0.82;
}

.category-item:hover {
  background: var(--appearance-menu-bg);
  color: var(--appearance-menu-text-color);
  opacity: 1;
}

.category-item.active {
  background: var(--appearance-menu-active-bg);
  color: var(--appearance-menu-text-color);
  border-color: var(--appearance-menu-border-color);
  opacity: 1;
}

.category-item.drop-target {
  background: rgba(102, 126, 234, 0.3);
  border: 2px dashed var(--primary-color);
  color: white;
  transform: scale(1.05);
}

/* ===== 分类排序拖拽动画 ===== */
/* 拖拽时只过渡不影响布局的属性，避免 hover 命中区域被动画推走 */
.category-nav.is-reordering .category-item {
  transition: background-color 0.16s ease,
              box-shadow 0.16s ease,
              border-color 0.2s ease,
              opacity 0.2s ease;
}

.category-nav.is-reordering .category-item::before,
.category-nav.is-reordering .category-item::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  z-index: 2;
  height: 5px;
  border-radius: 999px;
  background: linear-gradient(90deg, #22d3ee, var(--primary-color), #a855f7);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.55),
              0 0 14px color-mix(in srgb, var(--primary-color) 68%, transparent);
  opacity: 0;
  pointer-events: none;
}

/* 拖拽中：其他分类高亮绿色边框（静态，不浮动） */
.category-nav.is-reordering .category-item.sibling {
  border-color: rgba(16, 185, 129, 0.6);
}

/* 正在拖拽的分类：紫色边框 + 发光 + 半透明 */
.category-nav.is-reordering .category-item.dragging {
  border-color: var(--primary-color);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
  opacity: 0.55;
}

/* 插入位置指示：画线，不改变真实布局 */
.category-item.drag-before::before {
  top: 4px;
  opacity: 1;
}

.category-item.drag-after::after {
  bottom: 4px;
  opacity: 1;
}

.category-nav.is-reordering .category-item.drag-before,
.category-nav.is-reordering .category-item.drag-after {
  background: color-mix(in srgb, var(--primary-color) 12%, var(--appearance-menu-bg));
}

.category-name {
  font-size: 15px;
  font-weight: var(--appearance-menu-font-weight);
}

.category-item.active .category-name {
  font-weight: var(--appearance-menu-font-weight);
  color: var(--appearance-menu-text-color);
}

.category-count {
  font-size: 13px;
  opacity: 0.7;
  font-weight: 500;
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 8px;
  border-radius: 12px;
  min-width: 24px;
  text-align: center;
}

.category-item.active .category-count {
  background: rgba(255, 255, 255, 0.25);
  opacity: 1;
  color: white;
}

.btn-delete-category {
  padding: 4px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  color: rgba(255, 255, 255, 0.5);
  background: transparent;
}

.btn-delete-category:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  transform: scale(1.1);
}

/* 右侧站点面板：独立滚动 */
.sites-panel {
  padding: var(--spacing-lg);
  overflow-y: auto;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}

.panel-title {
  min-width: 0;
}

.panel-actions {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.panel-header h2 {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: var(--spacing-xs);
}

.site-count {
  font-size: 14px;
  opacity: 0.6;
}

.btn-panel-add-site,
.btn-panel-edit-mode {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--appearance-card-border-color) 36%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--appearance-card-bg) 78%, transparent);
  color: var(--appearance-card-text-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--transition-fast), opacity var(--transition-fast), background var(--transition-fast);
}

.btn-panel-add-site:hover,
.btn-panel-edit-mode:hover {
  opacity: 0.92;
  background: color-mix(in srgb, var(--appearance-card-bg) 92%, transparent);
  transform: translateY(-1px);
}

.btn-panel-edit-mode.active {
  background: color-mix(in srgb, #f59e0b 82%, #ef4444);
  border-color: color-mix(in srgb, #fbbf24 78%, #ef4444);
  color: #111827;
  box-shadow:
    0 0 0 1px rgba(251, 191, 36, 0.34),
    0 12px 28px rgba(245, 158, 11, 0.42);
}

.btn-panel-edit-mode.active:hover {
  opacity: 1;
  background: color-mix(in srgb, #fbbf24 82%, #ef4444);
  box-shadow:
    0 0 0 1px rgba(251, 191, 36, 0.42),
    0 14px 32px rgba(245, 158, 11, 0.5);
}

.sites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-md);
}

.sites-grid.is-site-reordering :deep(.site-card) {
  transition: border-color 0.16s ease,
              box-shadow 0.16s ease,
              opacity 0.16s ease,
              transform 0.16s ease;
}

.sites-grid.is-site-reordering :deep(.site-card)::before,
.sites-grid.is-site-reordering :deep(.site-card)::after {
  content: '';
  position: absolute;
  top: 10px;
  bottom: 10px;
  z-index: 4;
  width: 5px;
  border-radius: 999px;
  background: linear-gradient(180deg, #22d3ee, var(--primary-color), #a855f7);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.55),
              0 0 14px color-mix(in srgb, var(--primary-color) 68%, transparent);
  opacity: 0;
  pointer-events: none;
}

.sites-grid.is-site-reordering :deep(.site-card.site-drop-before)::before {
  left: 6px;
  opacity: 1;
}

.sites-grid.is-site-reordering :deep(.site-card.site-drop-after)::after {
  right: 6px;
  opacity: 1;
}

.sites-grid.is-site-reordering :deep(.site-card.site-drop-before),
.sites-grid.is-site-reordering :deep(.site-card.site-drop-after) {
  border-color: var(--primary-color);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--primary-color) 20%, transparent);
}

.empty-state {
  text-align: center;
  padding: var(--spacing-xl) 0;
  opacity: 0.5;
}

/* 响应式 */
@media (max-width: 1024px) {
  .sites-layout {
    grid-template-columns: 200px 1fr;
  }
}

@media (max-width: 768px) {
  .sites-layout {
    grid-template-columns: 1fr;
  }

  .category-sidebar-wrap {
    height: auto;
    margin-bottom: var(--spacing-lg);
  }

  .category-sidebar {
    position: static;
    height: auto;
    padding: var(--spacing-lg);
    overflow-y: visible;
  }

  .category-scroll-hint {
    display: none;
  }

  .category-nav {
    flex-direction: row;
    overflow-x: auto;
    gap: var(--spacing-sm);
    padding-bottom: var(--spacing-sm);
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .category-nav::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }

  .category-item {
    white-space: nowrap;
  }

  .sites-grid {
    grid-template-columns: 1fr;
  }
}

/* 新增分类弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: white;
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  width: 90%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-content h3 {
  margin: 0 0 var(--spacing-lg) 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.category-visibility-modal {
  max-width: 460px;
}

.category-visibility-modal h3 {
  margin-bottom: var(--spacing-md);
}

.visibility-list {
  max-height: min(48vh, 360px);
  margin-bottom: var(--spacing-lg);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.visibility-item {
  min-height: 42px;
  padding: 0 var(--spacing-md);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.025);
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--spacing-sm);
  color: #1f2937;
  cursor: pointer;
}

.visibility-item:hover {
  background: rgba(102, 126, 234, 0.08);
}

.visibility-item input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--primary-color);
}

.visibility-item span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.visibility-item small {
  min-width: 28px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
  color: #4b5563;
  text-align: center;
}

.modal-content > input {
  width: 100%;
  padding: var(--spacing-md);
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-md);
  font-size: 14px;
  margin-bottom: var(--spacing-lg);
  transition: border-color var(--transition-fast);
}

.modal-content > input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.modal-actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: flex-end;
}

.modal-actions button {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-cancel {
  background: transparent;
  color: #6b7280;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.btn-cancel:hover {
  background: rgba(0, 0, 0, 0.05);
}

.btn-confirm {
  background: var(--primary-color);
  color: white;
  border: none;
}

.btn-confirm:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
