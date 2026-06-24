<template>
  <div class="search-engine-page">
    <header class="search-header">
      <div class="logo">
        <img
          v-if="showCustomLogo"
          class="logo-image"
          :src="normalizedSiteLogo"
          :alt="settingsStore.siteTitle"
          @error="logoLoadFailed = true"
        />
        <img
          v-else
          class="logo-image"
          src="/logo.svg"
          :alt="settingsStore.siteTitle"
        />
      </div>
      <router-link to="/sites" class="btn-sites" title="站点导航">
        <AppIcon name="grid" :size="24" />
      </router-link>
    </header>

    <main class="search-main">
      <!-- 搜索引擎选择 -->
      <div class="engine-tabs">
        <button
          v-for="engine in searchEngines"
          :key="engine.id"
          class="engine-tab"
          :class="{ active: currentEngine.id === engine.id }"
          @click="currentEngine = engine"
        >
          <span class="engine-icon">{{ engine.icon }}</span>
          <span class="engine-name">{{ engine.name }}</span>
        </button>
      </div>

      <!-- 搜索框 -->
      <div class="search-box-container">
        <div class="search-box">
          <AppIcon class="search-icon" name="search" :size="24" />
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            :placeholder="currentEngine.placeholder"
            @keyup.enter="handleSearch"
            autofocus
          />
          <button class="btn-search" @click="handleSearch" :disabled="!searchQuery.trim()">
            搜索
          </button>
        </div>
      </div>

      <section class="quick-shortcuts" aria-label="快捷方式">
        <div
          v-for="shortcut in shortcuts"
          :key="shortcut.id || shortcut.url"
          class="shortcut-item"
        >
          <button
            v-if="authStore.isAuthenticated"
            class="shortcut-menu-trigger"
            type="button"
            title="快捷方式选项"
            aria-label="快捷方式选项"
            :aria-expanded="shortcut.id ? activeShortcutMenuId === shortcut.id : false"
            @click.stop="toggleShortcutMenu(shortcut.id)"
          >
            <AppIcon name="moreVertical" />
          </button>
          <div
            v-if="authStore.isAuthenticated && shortcut.id && activeShortcutMenuId === shortcut.id"
            class="shortcut-options"
            @click.stop
          >
            <button type="button" @click="openEditShortcutModal(shortcut)">
              <AppIcon name="editMode" :size="16" />
              <span>修改快捷方式</span>
            </button>
            <button type="button" class="danger" @click="removeShortcut(shortcut.id)">
              <AppIcon name="trash" :size="16" />
              <span>移除</span>
            </button>
          </div>
          <button
            class="shortcut-tile"
            type="button"
            :title="shortcut.name"
            @click="openShortcut(shortcut.url)"
          >
            <span class="shortcut-icon">
              <img
                v-if="isShortcutIconImage(shortcut.icon) && !isShortcutIconFailed(shortcut)"
                :src="shortcut.icon || undefined"
                :alt="shortcut.name"
                @error="handleShortcutIconError(shortcut)"
              />
              <span v-else class="shortcut-icon-placeholder">{{ getShortcutIconFallbackText(shortcut) }}</span>
            </span>
            <span class="shortcut-name">{{ shortcut.name }}</span>
          </button>
        </div>

        <button
          v-if="authStore.isAuthenticated"
          class="shortcut-item shortcut-add-item"
          type="button"
          @click="openShortcutModal"
        >
          <span class="shortcut-icon shortcut-add-icon">
            <AppIcon name="addSite" :size="22" />
          </span>
          <span class="shortcut-name">添加快捷方式</span>
        </button>
      </section>
    </main>

    <button
      v-if="!authStore.isAuthenticated"
      class="btn-submit-site"
      type="button"
      title="推荐站点"
      aria-label="推荐站点"
      @click="showSubmissionModal = true"
    >
      <AppIcon name="addSite" :size="22" />
    </button>

    <SiteSubmissionModal
      v-if="showSubmissionModal"
      @close="showSubmissionModal = false"
      @submitted="handleSubmitted"
    />

    <teleport to="body">
        <div v-if="showShortcutModal" class="shortcut-modal" @click.self="closeShortcutModal">
        <form class="shortcut-dialog" @submit.prevent="saveShortcut">
          <div class="shortcut-dialog-header">
            <h2>{{ editingShortcutId ? '修改快捷方式' : '添加快捷方式' }}</h2>
            <button class="shortcut-dialog-close" type="button" title="关闭" @click="closeShortcutModal">×</button>
          </div>

          <label class="shortcut-field">
            <span>名称</span>
            <input
              v-model="shortcutForm.name"
              type="text"
              maxlength="18"
              autocomplete="off"
              placeholder="例如 GitHub"
            />
          </label>

          <label class="shortcut-field">
            <span>URL</span>
            <input
              v-model="shortcutForm.url"
              type="text"
              autocomplete="off"
              placeholder="example.com"
            />
          </label>

          <p v-if="shortcutError" class="shortcut-error">{{ shortcutError }}</p>

          <div class="shortcut-actions">
            <button class="shortcut-cancel" type="button" @click="closeShortcutModal">取消</button>
            <button class="shortcut-save" type="submit">完成</button>
          </div>
        </form>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useShortcutsStore } from '@/stores/shortcuts'
import { useSettingsStore } from '@/stores/settings'
import SiteSubmissionModal from '@/components/common/SiteSubmissionModal.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import type { Shortcut } from '@/stores/shortcuts'

interface SearchEngine {
  id: string
  name: string
  urlTemplate: string
  icon: string
  placeholder: string
}

const searchEngines: SearchEngine[] = [
  {
    id: 'google',
    name: 'Google',
    urlTemplate: 'https://www.google.com/search?q={query}',
    icon: '🔍',
    placeholder: 'Search with Google'
  },
  {
    id: 'bing',
    name: 'Bing',
    urlTemplate: 'https://www.bing.com/search?q={query}',
    icon: '🌐',
    placeholder: 'Search with Bing'
  },
  {
    id: 'baidu',
    name: '百度',
    urlTemplate: 'https://www.baidu.com/s?wd={query}',
    icon: '🔎',
    placeholder: '百度一下，你就知道'
  },
  {
    id: 'github',
    name: 'GitHub',
    urlTemplate: 'https://github.com/search?q={query}&type=repositories',
    icon: '💻',
    placeholder: 'Search repositories on GitHub'
  }
]

const currentEngine = ref<SearchEngine>(searchEngines[0])
const searchQuery = ref('')
const authStore = useAuthStore()
const shortcutsStore = useShortcutsStore()
const settingsStore = useSettingsStore()
const shortcuts = computed(() => shortcutsStore.shortcuts)
const logoLoadFailed = ref(false)
const normalizedSiteLogo = computed(() => normalizeLogoUrl(settingsStore.siteLogo))
const showCustomLogo = computed(() => Boolean(normalizedSiteLogo.value) && !logoLoadFailed.value)
const showShortcutModal = ref(false)
const showSubmissionModal = ref(false)
const activeShortcutMenuId = ref<number | null>(null)
const editingShortcutId = ref<number | null>(null)
const shortcutForm = ref({
  name: '',
  url: ''
})
const shortcutError = ref('')
const failedShortcutIconKeys = ref<Set<string>>(new Set())

onMounted(() => {
  shortcutsStore.fetchShortcuts()
  window.addEventListener('click', closeShortcutMenu)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', closeShortcutMenu)
})

watch(normalizedSiteLogo, () => {
  logoLoadFailed.value = false
})

watch(shortcuts, () => {
  failedShortcutIconKeys.value = new Set()
})

function handleSearch() {
  if (!searchQuery.value.trim()) return

  const url = currentEngine.value.urlTemplate.replace(
    '{query}',
    encodeURIComponent(searchQuery.value.trim())
  )

  window.open(url, '_blank')
  searchQuery.value = ''
}

function getShortcutInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase()
}

function isShortcutIconImage(icon: string | null | undefined) {
  if (!icon) return false

  const trimmed = icon.trim()
  if (!trimmed) return false
  if (trimmed.length === 1) return false
  if (trimmed.startsWith('/')) return true
  if (trimmed.startsWith('data:image/')) return true
  if (trimmed.includes('google.com/s2/favicons')) return true
  return /^https?:\/\//i.test(trimmed)
}

function getShortcutIconKey(shortcut: { id?: number; url: string }) {
  return shortcut.id ? `id:${shortcut.id}` : `url:${shortcut.url}`
}

function isShortcutIconFailed(shortcut: { id?: number; url: string }) {
  return failedShortcutIconKeys.value.has(getShortcutIconKey(shortcut))
}

function handleShortcutIconError(shortcut: { id?: number; url: string }) {
  failedShortcutIconKeys.value = new Set([
    ...failedShortcutIconKeys.value,
    getShortcutIconKey(shortcut)
  ])
}

function getShortcutIconFallbackText(shortcut: { icon?: string | null; name: string }) {
  const icon = (shortcut.icon || '').trim()
  if (icon && icon.length <= 2 && !icon.includes('/') && !icon.includes(':')) {
    return icon.toUpperCase()
  }

  return getShortcutInitial(shortcut.name)
}

function getFallbackShortcutIcon(url: string) {
  try {
    const hostname = new URL(normalizeShortcutUrl(url)).hostname
    return hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=128` : null
  } catch {
    return null
  }
}

function normalizeLogoUrl(url: string) {
  const trimmedUrl = url.trim().slice(0, 500)

  if (!trimmedUrl) return ''
  if (trimmedUrl.startsWith('/') && !trimmedUrl.startsWith('//')) return trimmedUrl
  if (/^https?:\/\//i.test(trimmedUrl)) return trimmedUrl

  return ''
}

function normalizeShortcutUrl(url: string) {
  const trimmedUrl = url.trim()

  if (!trimmedUrl) return ''
  if (trimmedUrl.startsWith('/') || trimmedUrl.startsWith('#')) return trimmedUrl
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmedUrl)) return trimmedUrl

  return `https://${trimmedUrl}`
}

function isValidShortcutUrl(url: string) {
  if (url.startsWith('/') || url.startsWith('#')) return true

  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

function openShortcut(url: string) {
  closeShortcutMenu()
  window.open(normalizeShortcutUrl(url), '_blank', 'noopener,noreferrer')
}

function openShortcutModal() {
  editingShortcutId.value = null
  activeShortcutMenuId.value = null
  shortcutForm.value = {
    name: '',
    url: ''
  }
  shortcutError.value = ''
  showShortcutModal.value = true
}

function openEditShortcutModal(shortcut: Shortcut) {
  if (!shortcut.id) return

  editingShortcutId.value = shortcut.id
  activeShortcutMenuId.value = null
  shortcutForm.value = {
    name: shortcut.name,
    url: shortcut.url
  }
  shortcutError.value = ''
  showShortcutModal.value = true
}

function closeShortcutModal() {
  showShortcutModal.value = false
  shortcutError.value = ''
  editingShortcutId.value = null
}

function toggleShortcutMenu(id?: number) {
  if (!id) return
  activeShortcutMenuId.value = activeShortcutMenuId.value === id ? null : id
}

function closeShortcutMenu() {
  activeShortcutMenuId.value = null
}

async function saveShortcut() {
  const name = shortcutForm.value.name.trim()
  const url = normalizeShortcutUrl(shortcutForm.value.url)

  if (!name || !url) {
    shortcutError.value = '请填写名称和 URL'
    return
  }

  if (!isValidShortcutUrl(url)) {
    shortcutError.value = '请输入有效的 URL'
    return
  }

  const success = editingShortcutId.value
    ? await shortcutsStore.updateShortcut(editingShortcutId.value, {
      name,
      url,
      icon: getFallbackShortcutIcon(url)
    })
    : await shortcutsStore.createShortcut({
      name,
      url,
      icon: getFallbackShortcutIcon(url),
      sort: shortcuts.value.length
    })

  if (success) {
    closeShortcutModal()
    return
  }

  shortcutError.value = shortcutsStore.error || '保存失败'
}

function removeShortcut(id?: number) {
  if (!id) return
  activeShortcutMenuId.value = null
  shortcutsStore.deleteShortcut(id)
}

function handleSubmitted() {
  window.setTimeout(() => {
    showSubmissionModal.value = false
  }, 1200)
}
</script>

<style scoped>
.search-engine-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: var(--spacing-lg);
}

.search-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  cursor: default;
  color: var(--primary-color);
  opacity: 0.92;
  transition: opacity var(--transition-fast);
}

.logo:hover {
  opacity: 1;
}

.logo-image {
  display: block;
  width: 54px;
  height: 54px;
  max-width: 54px;
  max-height: 54px;
  object-fit: contain;
}

.btn-sites {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  background: rgba(0, 0, 0, 0.05);
}

.btn-sites:hover {
  background: rgba(0, 0, 0, 0.1);
  transform: scale(1.05);
}

/* 主体内容 */
.search-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  padding-top: clamp(112px, 18vh, 168px);
  box-sizing: border-box;
}

/* 搜索引擎选择 */
.engine-tabs {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xl);
  flex-wrap: wrap;
  justify-content: center;
}

.engine-tab {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: 24px;
  font-size: 15px;
  font-weight: 500;
  transition: all var(--transition-fast);
  background: rgba(0, 0, 0, 0.05);
  cursor: pointer;
}

.engine-tab:hover {
  background: rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.engine-tab.active {
  background: var(--primary-color);
  color: white;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.engine-icon {
  font-size: 18px;
}

.engine-name {
  font-size: 15px;
}

/* 搜索框容器 */
.search-box-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.search-box {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 600px;
  height: 56px;
  padding: 0 var(--spacing-md);
  background: white;
  border-radius: 28px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  transition: box-shadow var(--transition-fast);
}

.search-box:focus-within {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.search-icon {
  flex-shrink: 0;
  margin-right: var(--spacing-md);
  opacity: 0.4;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 18px;
  background: transparent;
}

.search-input::placeholder {
  color: rgba(0, 0, 0, 0.4);
}

.btn-search {
  flex-shrink: 0;
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--primary-color);
  color: white;
  border-radius: 20px;
  font-size: 15px;
  font-weight: 600;
  transition: all var(--transition-fast);
  margin-left: var(--spacing-md);
}

.btn-search:hover:not(:disabled) {
  opacity: 0.9;
  transform: scale(1.02);
}

.btn-search:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-shortcuts {
  width: min(100%, 640px);
  display: grid;
  grid-template-columns: repeat(5, 112px);
  justify-content: center;
  gap: 8px 10px;
  margin-top: 30px;
}

.shortcut-item {
  position: relative;
  width: 100%;
  height: 112px;
  border: 0;
  background: transparent;
  color: inherit;
  border-radius: 6px;
  overflow: visible;
}

.shortcut-tile {
  width: 100%;
  height: 100%;
}

.shortcut-tile,
.shortcut-add-item {
  border: 0;
  background: transparent;
  color: rgba(0, 0, 0, 0.78);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 8px 8px 10px;
  transition: background var(--transition-fast), transform var(--transition-fast);
}

.shortcut-tile:hover,
.shortcut-add-item:hover,
.shortcut-tile:focus-visible,
.shortcut-add-item:focus-visible {
  background: rgba(0, 0, 0, 0.06);
  outline: none;
}

.shortcut-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.08);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: currentColor;
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
}

.shortcut-icon img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.shortcut-icon-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  color: white;
  background:
    radial-gradient(circle at 28% 22%, rgba(255, 255, 255, 0.6), transparent 30%),
    linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  box-shadow: 0 10px 24px rgba(102, 126, 234, 0.28);
}

.shortcut-add-icon {
  color: var(--primary-color);
}

.shortcut-name {
  width: 100%;
  min-height: 34px;
  display: -webkit-box;
  overflow: hidden;
  text-align: center;
  font-size: 13px;
  line-height: 17px;
  word-break: break-word;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.shortcut-menu-trigger {
  position: absolute;
  top: 6px;
  right: -2px;
  z-index: 4;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 50%;
  color: rgba(0, 0, 0, 0.64);
  background: rgba(255, 255, 255, 0.84);
  opacity: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: opacity var(--transition-fast), background var(--transition-fast);
}

.shortcut-item:hover .shortcut-menu-trigger,
.shortcut-item:focus-within .shortcut-menu-trigger,
.shortcut-menu-trigger:focus-visible,
.shortcut-menu-trigger[aria-expanded="true"] {
  opacity: 1;
}

.shortcut-menu-trigger:hover {
  background: rgba(255, 255, 255, 0.94);
}

.shortcut-options {
  position: absolute;
  top: 36px;
  right: -2px;
  z-index: 8;
  width: 178px;
  padding: 6px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.98);
  color: rgba(0, 0, 0, 0.82);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.22);
}

.shortcut-options button {
  width: 100%;
  height: 36px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  font-size: 13px;
  text-align: left;
}

.shortcut-options button:hover {
  background: rgba(0, 0, 0, 0.06);
}

.shortcut-options button.danger {
  color: #d93025;
}

.theme-glass .shortcut-tile,
.theme-glass .shortcut-add-item {
  color: rgba(255, 255, 255, 0.92);
}

.theme-glass .shortcut-icon {
  background: rgba(255, 255, 255, 0.18);
}

.theme-glass .shortcut-icon-placeholder {
  background:
    radial-gradient(circle at 28% 22%, rgba(255, 255, 255, 0.64), transparent 30%),
    linear-gradient(135deg, rgba(96, 165, 250, 0.96), rgba(168, 85, 247, 0.94));
}

.theme-glass .shortcut-tile:hover,
.theme-glass .shortcut-add-item:hover,
.theme-glass .shortcut-tile:focus-visible,
.theme-glass .shortcut-add-item:focus-visible {
  background: rgba(255, 255, 255, 0.12);
}

.theme-cyberpunk .shortcut-tile,
.theme-cyberpunk .shortcut-add-item {
  color: #00ffff;
}

.theme-cyberpunk .shortcut-icon {
  background: rgba(0, 255, 255, 0.12);
  box-shadow: inset 0 0 14px rgba(0, 255, 255, 0.12);
}

.theme-cyberpunk .shortcut-icon-placeholder {
  background:
    radial-gradient(circle at 28% 22%, rgba(0, 255, 255, 0.34), transparent 30%),
    linear-gradient(135deg, #0a0e27, #2b1055 58%, #00ffff);
  box-shadow:
    0 0 18px rgba(0, 255, 255, 0.46),
    inset 0 0 18px rgba(255, 0, 255, 0.16);
}

.theme-cyberpunk .shortcut-tile:hover,
.theme-cyberpunk .shortcut-add-item:hover,
.theme-cyberpunk .shortcut-tile:focus-visible,
.theme-cyberpunk .shortcut-add-item:focus-visible {
  background: rgba(0, 255, 255, 0.08);
}

.theme-glass .shortcut-menu-trigger {
  color: rgba(255, 255, 255, 0.92);
  background: rgba(255, 255, 255, 0.16);
}

.theme-glass .shortcut-menu-trigger:hover {
  background: rgba(255, 255, 255, 0.24);
}

.theme-glass .shortcut-options {
  background: rgba(22, 28, 45, 0.96);
  color: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.theme-glass .shortcut-options button:hover {
  background: rgba(255, 255, 255, 0.12);
}

.theme-cyberpunk .shortcut-menu-trigger {
  color: #00ffff;
  background: rgba(10, 14, 39, 0.82);
}

.theme-cyberpunk .shortcut-menu-trigger:hover {
  background: rgba(0, 255, 255, 0.14);
}

.theme-cyberpunk .shortcut-options {
  background: rgba(10, 14, 39, 0.96);
  color: #00ffff;
  border: 1px solid rgba(0, 255, 255, 0.28);
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.18);
}

.theme-cyberpunk .shortcut-options button:hover {
  background: rgba(0, 255, 255, 0.12);
}

.shortcut-modal {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  background: rgba(0, 0, 0, 0.42);
}

.shortcut-dialog {
  width: min(100%, 420px);
  padding: 22px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
  color: rgba(0, 0, 0, 0.84);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.shortcut-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.shortcut-dialog-header h2 {
  font-size: 20px;
  font-weight: 600;
}

.shortcut-dialog-close {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.shortcut-dialog-close:hover {
  background: rgba(0, 0, 0, 0.06);
}

.shortcut-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.64);
}

.shortcut-field input {
  height: 44px;
  border: 0;
  border-radius: 4px;
  padding: 0 12px;
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.84);
  outline: none;
  font-size: 15px;
}

.shortcut-field input:focus {
  box-shadow: inset 0 -2px 0 var(--primary-color);
}

.shortcut-error {
  margin: -4px 0 0;
  color: #d93025;
  font-size: 13px;
}

.shortcut-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.shortcut-cancel,
.shortcut-save {
  height: 36px;
  padding: 0 18px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.shortcut-cancel {
  border: 0;
  background: transparent;
  color: var(--primary-color);
}

.shortcut-cancel:hover {
  background: rgba(0, 0, 0, 0.06);
}

.shortcut-save {
  border: 0;
  background: var(--primary-color);
  color: white;
}

.btn-submit-site {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 50;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--appearance-topbar-border-color) 22%, transparent);
  border-radius: 50%;
  background: var(--appearance-topbar-control-bg);
  color: var(--appearance-topbar-text-color);
  display: inline-flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  transition: transform var(--transition-fast);
}

.btn-submit-site:hover {
  background: var(--appearance-topbar-control-bg-hover);
  transform: translateY(-1px);
}

/* 响应式 */
@media (max-width: 768px) {
  .search-engine-page {
    padding: var(--spacing-md);
  }

  .search-header {
    padding: var(--spacing-md);
  }

  .site-logo {
    font-size: 20px;
  }

  .search-main {
    padding-top: 108px;
  }

  .search-box {
    max-width: 100%;
    height: 52px;
  }

  .search-input {
    font-size: 16px;
  }

  .engine-tabs {
    gap: var(--spacing-xs);
  }

  .engine-tab {
    padding: var(--spacing-xs) var(--spacing-md);
    font-size: 14px;
  }

  .engine-icon {
    font-size: 16px;
  }

  .quick-shortcuts {
    width: min(100%, 360px);
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
    margin-top: 24px;
  }

  .shortcut-item {
    height: 96px;
  }

  .shortcut-icon {
    width: 44px;
    height: 44px;
  }

  .shortcut-name {
    font-size: 12px;
    line-height: 16px;
  }
}
</style>
