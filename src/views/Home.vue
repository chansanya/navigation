<template>
  <div class="home-view">
    <header class="home-header">
      <div class="title-area">
        <router-link
          to="/"
          class="site-title"
          :class="{ 'site-title-logo': !displaySiteTitle }"
          :aria-label="displaySiteTitle || '返回首页'"
        >
          <span v-if="displaySiteTitle">{{ displaySiteTitle }}</span>
          <img
            v-else-if="showCustomLogo"
            class="site-title-logo-image"
            :src="normalizedSiteLogo"
            alt="首页"
            @error="logoLoadFailed = true"
          />
          <img
            v-else
            class="site-title-logo-image"
            src="/logo.svg"
            alt="首页"
          />
        </router-link>
        <PrivacyHotspot @changed="refreshSiteData" />
      </div>
      <div class="header-search">
        <div class="site-search-box">
          <AppIcon name="search" :size="16" />
          <input
            v-model="siteSearchQuery"
            type="search"
            placeholder="搜索站点"
            autocomplete="off"
          />
          <button
            v-if="siteSearchQuery"
            class="btn-clear-search"
            type="button"
            title="清空搜索"
            @click="siteSearchQuery = ''"
          >
            ×
          </button>
        </div>
      </div>
      <div class="header-actions">
        <button
          v-if="authStore.isAuthenticated"
          type="button"
          class="btn-admin btn-review"
          title="审核"
          aria-label="审核"
          @click="showReviewModal = true"
        >
          <AppIcon name="review" />
        </button>
        <button
          v-if="authStore.isAuthenticated"
          type="button"
          class="btn-admin btn-import-cf"
          title="同步 CF"
          aria-label="同步 CF"
          @click="showImportModal = true"
        >
          <AppIcon name="cloudSync" />
        </button>
        <button
          v-if="authStore.isAuthenticated"
          type="button"
          class="btn-admin btn-import-bookmarks"
          title="导入书签"
          aria-label="导入书签"
          @click="showBookmarkImportModal = true"
        >
          <AppIcon name="bookmarkImport" />
        </button>
        <button
          v-if="!authStore.isAuthenticated"
          type="button"
          class="btn-admin"
          title="认证"
          aria-label="认证"
          @click="handleAuthEntry"
        >
          <AppIcon name="auth" />
        </button>
        <button
          v-if="authStore.isAuthenticated"
          class="btn-settings"
          type="button"
          @click="showSettings = !showSettings"
          title="设置"
          aria-label="设置"
        >
          <AppIcon name="settings" />
        </button>
      </div>
    </header>

    <main class="home-content">
      <Loading v-if="sitesStore.loading" :loading="true" message="加载中..." />

      <div v-else-if="sitesStore.error" class="error-message">
        {{ sitesStore.error }}
      </div>

      <div v-else-if="sitesStore.categories.length === 0" class="empty-state">
        <p>暂无站点，前往<button type="button" class="empty-admin-link" @click="handleAuthEntry">认证</button>后添加</p>
      </div>

      <SitesLayout
        v-else
        :categories="sitesStore.categories"
        :search-query="siteSearchQuery"
        :show-actions="editMode"
        :can-edit="authStore.isAuthenticated"
        @edit="handleEdit"
        @delete="handleDelete"
        @toggle-edit-mode="editMode = !editMode"
        @change-category="handleChangeCategory"
        @reorder-category="handleReorderCategory"
        @reorder-site="handleReorderSite"
        @add-category="handleAddCategory"
        @add-site="handleAddSite"
        @delete-category="handleDeleteCategory"
        @select-category="handleSelectCategory"
      />
    </main>

    <transition name="fade">
      <div v-if="showEditor" class="modal-overlay" @click="closeEditor">
        <div class="modal-content" @click.stop>
          <SiteEditor
            :site="editingSite"
            :default-category="selectedCategory"
            @save="handleSave"
            @cancel="closeEditor"
          />
        </div>
      </div>
    </transition>

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

    <AdminLoginModal
      v-if="showAdminLogin"
      @close="showAdminLogin = false"
      @success="handleAdminLoginSuccess"
    />

    <CloudflareImport
      v-if="showImportModal"
      @close="showImportModal = false"
      @imported="handleImported"
    />

    <BookmarkImport
      v-if="showBookmarkImportModal"
      @close="showBookmarkImportModal = false"
      @imported="handleImported"
    />

    <SubmissionReviewModal
      v-if="showReviewModal"
      @close="showReviewModal = false"
      @changed="refreshSiteData"
    />

    <!-- 设置面板 -->
    <transition name="slide">
      <div v-if="showSettings && authStore.isAuthenticated" class="settings-overlay" @click="showSettings = false">
        <div class="settings-panel" @click.stop>
          <div class="panel-header">
            <h2>外观设置</h2>
            <button class="btn-close" @click="showSettings = false">✕</button>
          </div>
          <div class="settings-panel-body">
            <PresetConfig />
            <ThemeSwitcher />
            <BackgroundConfig />
            <AppearanceConfig />
            <div class="settings-footer">
              <button class="btn-logout-auth" type="button" @click="handleLogout">退出认证</button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useSitesStore } from '@/stores/sites'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import type { Site } from '@/stores/sites'
import SitesLayout from '@/components/common/SitesLayout.vue'
import Loading from '@/components/common/Loading.vue'
import SiteEditor from '@/components/admin/SiteEditor.vue'
import PresetConfig from '@/components/settings/PresetConfig.vue'
import ThemeSwitcher from '@/components/settings/ThemeSwitcher.vue'
import BackgroundConfig from '@/components/settings/BackgroundConfig.vue'
import AppearanceConfig from '@/components/settings/AppearanceConfig.vue'
import PrivacyHotspot from '@/components/common/PrivacyHotspot.vue'
import SiteSubmissionModal from '@/components/common/SiteSubmissionModal.vue'
import AdminLoginModal from '@/components/common/AdminLoginModal.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import CloudflareImport from '@/components/admin/CloudflareImport.vue'
import BookmarkImport from '@/components/admin/BookmarkImport.vue'
import SubmissionReviewModal from '@/components/admin/SubmissionReviewModal.vue'

const sitesStore = useSitesStore()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const showSettings = ref(false)
const showSubmissionModal = ref(false)
const showAdminLogin = ref(false)
const showEditor = ref(false)
const showImportModal = ref(false)
const showBookmarkImportModal = ref(false)
const showReviewModal = ref(false)
const editMode = ref(false)
const editingSite = ref<Site | null>(null)
const selectedCategory = ref('')
const siteSearchQuery = ref('')
const logoLoadFailed = ref(false)
const displaySiteTitle = computed(() => settingsStore.siteTitle.trim())
const normalizedSiteLogo = computed(() => normalizeLogoUrl(settingsStore.siteLogo))
const showCustomLogo = computed(() => Boolean(normalizedSiteLogo.value) && !logoLoadFailed.value)

onMounted(() => {
  refreshSiteData()
})

watch(() => authStore.isAuthenticated, (isAuthenticated) => {
  if (!isAuthenticated) {
    showSettings.value = false
    editMode.value = false
  }
})

watch(normalizedSiteLogo, () => {
  logoLoadFailed.value = false
})

function refreshSiteData() {
  sitesStore.fetchCategories()
  sitesStore.fetchSites()
}

function handleSubmitted() {
  window.setTimeout(() => {
    showSubmissionModal.value = false
  }, 1200)
}

function handleImported() {
  refreshSiteData()
}

function handleAuthEntry() {
  if (authStore.isAuthenticated) {
    return
  }

  showAdminLogin.value = true
}

function handleAdminLoginSuccess() {
  showAdminLogin.value = false
  refreshSiteData()
}

function handleLogout() {
  authStore.logout()
  showSettings.value = false
  editMode.value = false
}

function handleEdit(site: Site) {
  editingSite.value = { ...site }
  showEditor.value = true
}

function handleAddSite(category?: string) {
  if (category) {
    selectedCategory.value = category
  }
  editingSite.value = null
  showEditor.value = true
}

async function handleDelete(site: Site) {
  if (confirm(`确定要删除站点"${site.name}"吗？`)) {
    await sitesStore.deleteSite(site.id!)
  }
}

async function handleSave(siteData: Site) {
  let success = false

  if (editingSite.value?.id) {
    success = await sitesStore.updateSite(editingSite.value.id, siteData)
  } else {
    success = await sitesStore.createSite(siteData)
  }

  if (!success) {
    alert(sitesStore.error || '保存失败')
    return
  }

  closeEditor()
}

function closeEditor() {
  showEditor.value = false
  editingSite.value = null
}

async function handleChangeCategory(site: Site, newCategory: string) {
  await sitesStore.updateSite(site.id!, {
    ...site,
    category: newCategory
  })
}

function handleSelectCategory(category: string) {
  selectedCategory.value = category
}

async function handleReorderCategory(fromIndex: number, toIndex: number) {
  const categories = [...sitesStore.categoryList]
  const [movedCategory] = categories.splice(fromIndex, 1)
  categories.splice(toIndex, 0, movedCategory)

  for (let i = 0; i < categories.length; i += 1) {
    const newSort = 100 - i * 10
    if (categories[i].id && categories[i].sort !== newSort) {
      await sitesStore.updateCategorySort(categories[i].id!, newSort)
    }
  }
}

async function handleReorderSite(category: string, fromIndex: number, toIndex: number) {
  const categoryGroup = sitesStore.categories.find((item) => item.category === category)
  if (!categoryGroup) return

  const sites = [...categoryGroup.sites]
  const [movedSite] = sites.splice(fromIndex, 1)
  if (!movedSite) return

  sites.splice(toIndex, 0, movedSite)

  for (let i = 0; i < sites.length; i += 1) {
    const site = sites[i]
    const newSort = 1000 - i * 10
    if (site.id && site.sort !== newSort) {
      await sitesStore.updateSite(site.id, { sort: newSort })
    }
  }
}

function handleAddCategory(name: string) {
  if (name && name.trim()) {
    sitesStore.createCategory(name.trim())
  }
}

async function handleDeleteCategory(categoryId: number, categoryName: string) {
  if (confirm(`确定要删除分类"${categoryName}"吗？`)) {
    await sitesStore.deleteCategory(categoryId)
  }
}

function normalizeLogoUrl(url: string) {
  const trimmedUrl = url.trim().slice(0, 500)

  if (!trimmedUrl) return ''
  if (trimmedUrl.startsWith('/') && !trimmedUrl.startsWith('//')) return trimmedUrl
  if (/^https?:\/\//i.test(trimmedUrl)) return trimmedUrl

  return ''
}
</script>

<style scoped>
.home-view {
  min-height: 100vh;
  padding: var(--spacing-md);
}

.home-header {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(240px, 420px) minmax(180px, 1fr);
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--appearance-topbar-bg);
  color: var(--appearance-topbar-text-color);
  border: 1px solid color-mix(in srgb, var(--appearance-topbar-border-color) 34%, transparent);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.title-area {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
}

.site-title {
  font-size: 32px;
  font-weight: var(--appearance-topbar-font-weight);
  color: var(--appearance-topbar-text-color);
  text-decoration: none;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.site-title-logo {
  width: 46px;
  height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.site-title-logo-image {
  display: block;
  width: 42px;
  height: 42px;
  max-width: 42px;
  max-height: 42px;
  object-fit: contain;
}

.site-title:hover {
  opacity: 0.82;
  text-decoration: none;
}

.site-title:visited,
.site-title:active,
.site-title:focus {
  color: var(--appearance-topbar-text-color);
  text-decoration: none;
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

.header-search {
  display: flex;
  justify-content: center;
}

.btn-settings,
.btn-admin {
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  color: var(--appearance-topbar-text-color);
}

.btn-settings :deep(.app-icon),
.btn-admin :deep(.app-icon) {
  flex-shrink: 0;
  opacity: 0.82;
}

.site-search-box {
  width: 100%;
  height: 38px;
  padding: 0 10px;
  background: color-mix(in srgb, var(--appearance-topbar-bg) 72%, transparent);
  border: 1px solid color-mix(in srgb, var(--appearance-topbar-border-color) 28%, transparent);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--appearance-topbar-text-color);
  transition: all var(--transition-fast);
}

.site-search-box:focus-within {
  background: color-mix(in srgb, var(--appearance-topbar-bg) 92%, transparent);
  border-color: color-mix(in srgb, var(--appearance-topbar-border-color) 56%, transparent);
}

.site-search-box :deep(.app-icon) {
  flex-shrink: 0;
  opacity: 0.72;
}

.site-search-box input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--appearance-topbar-text-color);
  font-size: 14px;
  font-weight: var(--appearance-topbar-font-weight);
}

.site-search-box input::placeholder {
  color: color-mix(in srgb, var(--appearance-topbar-text-color) 62%, transparent);
}

.btn-clear-search {
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--appearance-topbar-text-color) 16%, transparent);
  color: var(--appearance-topbar-text-color);
  font-size: 16px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-admin {
  background: var(--appearance-topbar-control-bg);
  color: var(--appearance-topbar-text-color);
  text-decoration: none;
  border: 1px solid color-mix(in srgb, var(--appearance-topbar-border-color) 22%, transparent);
}

.btn-admin.active {
  background: color-mix(in srgb, var(--primary-color) 34%, transparent);
  border-color: color-mix(in srgb, var(--appearance-topbar-border-color) 66%, var(--primary-color));
  color: #ffffff;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--primary-color) 18%, transparent),
    0 10px 26px color-mix(in srgb, var(--primary-color) 26%, transparent);
}

.btn-admin.active :deep(.app-icon) {
  opacity: 1;
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--primary-color) 48%, transparent));
}

.btn-admin:hover {
  opacity: 0.9;
  background: var(--appearance-topbar-control-bg-hover);
  transform: translateY(-1px);
}

.btn-admin.active:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--primary-color) 44%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--primary-color) 24%, transparent),
    0 12px 30px color-mix(in srgb, var(--primary-color) 34%, transparent);
}

.btn-settings {
  background: var(--appearance-topbar-control-bg);
  border: 1px solid color-mix(in srgb, var(--appearance-topbar-border-color) 22%, transparent);
}

.btn-settings:hover {
  background: var(--appearance-topbar-control-bg-hover);
  transform: translateY(-1px);
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
}

.btn-submit-site:hover {
  background: var(--appearance-topbar-control-bg-hover);
  transform: translateY(-1px);
}

.home-content {
  /* 移除 max-width，让内容铺满 */
}

.error-message,
.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  font-size: 16px;
  opacity: 0.7;
}

.empty-state a {
  color: var(--primary-color);
  text-decoration: underline;
}

.empty-admin-link {
  color: var(--primary-color);
  text-decoration: underline;
  vertical-align: baseline;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  padding: var(--spacing-lg);
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  width: 100%;
  max-width: 600px;
  max-height: 95vh;
  overflow-y: auto;
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.modal-content::-webkit-scrollbar {
  display: none;
}

/* 设置面板 */
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.settings-panel {
  width: 400px;
  max-width: 90vw;
  height: 100%;
  background: white;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.2);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  background: white;
  z-index: 10;
}

.panel-header h2 {
  font-size: 20px;
  font-weight: 600;
}

.settings-panel-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.settings-footer {
  margin-top: auto;
  padding: var(--spacing-lg);
  display: flex;
  justify-content: center;
}

.btn-logout-auth {
  height: 36px;
  min-width: 120px;
  padding: 0 var(--spacing-lg);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.06);
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
}

.btn-logout-auth:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #374151;
}

.btn-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: background var(--transition-fast);
}

.btn-close:hover {
  background: rgba(0, 0, 0, 0.1);
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active,
.slide-enter-active,
.slide-leave-active {
  transition: opacity var(--transition-normal);
}

.slide-enter-active .settings-panel,
.slide-leave-active .settings-panel {
  transition: transform var(--transition-normal);
}

.slide-enter-from,
.slide-leave-to,
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-from .settings-panel,
.slide-leave-to .settings-panel {
  transform: translateX(100%);
}

@media (max-width: 768px) {
  .home-view {
    padding: var(--spacing-md);
  }

  .home-header {
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
    text-align: center;
  }

  .title-area {
    justify-content: center;
  }

  .header-search {
    width: 100%;
  }

  .header-actions {
    width: 100%;
    flex-wrap: wrap;
    justify-content: center;
  }

  .site-search-box {
    width: 100%;
    max-width: 360px;
  }

  .site-title {
    font-size: 24px;
  }
}
</style>
