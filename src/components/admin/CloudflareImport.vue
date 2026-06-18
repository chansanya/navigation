<template>
  <div class="import-modal-overlay" @click.self="$emit('close')">
    <div class="import-modal">
      <header class="modal-header">
        <h2>同步 Cloudflare 项目</h2>
        <button class="btn-close" @click="$emit('close')">✕</button>
      </header>

      <div class="modal-content">
        <div v-if="loading" class="loading-state">
          <p>正在获取项目列表...</p>
        </div>

        <div v-else-if="error" class="error-state">
          <p>{{ error }}</p>
          <button class="btn-retry" @click="fetchProjects">重试</button>
        </div>

        <div v-else-if="projects.length === 0" class="empty-state">
          <p>未找到 Cloudflare 项目</p>
          <p class="hint">请确保已配置 API Token 和 Account ID</p>
        </div>

        <div v-else class="projects-list">
          <div class="select-all">
            <label>
              <input type="checkbox" v-model="selectAll" @change="toggleSelectAll" />
              <span>全选（{{ selectedProjects.length }} / {{ importableProjects.length }}）</span>
            </label>
          </div>

          <div
            v-for="project in projects"
            :key="project.id"
            class="project-item"
            :class="{
              selected: selectedProjects.includes(project.id),
              imported: isProjectImported(project)
            }"
            @click="toggleProject(project)"
          >
            <input
              type="checkbox"
              :checked="selectedProjects.includes(project.id) || isProjectImported(project)"
              :disabled="isProjectImported(project)"
            />
            <div class="project-info">
              <div class="project-header">
                <span class="project-name">{{ project.name }}</span>
                <span class="project-type" :class="project.type">{{ project.type }}</span>
                <span v-if="isProjectImported(project)" class="project-imported">已存在</span>
              </div>
              <div class="project-url">{{ project.url }}</div>
            </div>
          </div>
        </div>
      </div>

      <footer class="modal-footer">
        <button class="btn-cancel" @click="$emit('close')">取消</button>
        <button
          class="btn-import"
          @click="handleImport"
          :disabled="selectedProjects.length === 0 || importing"
        >
          {{ importing ? '同步中...' : `同步 ${selectedProjects.length} 个项目` }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSitesStore } from '@/stores/sites'
import type { Category } from '@/stores/sites'

interface CloudflareProject {
  id: string
  name: string
  type: 'pages' | 'workers'
  url: string
  created_at: string
}

const emit = defineEmits<{
  close: []
  imported: []
}>()

const sitesStore = useSitesStore()

const loading = ref(false)
const error = ref('')
const projects = ref<CloudflareProject[]>([])
const selectedProjects = ref<string[]>([])
const existingSiteUrls = ref<Set<string>>(new Set())
const importing = ref(false)
const cloudflareCategoryName = 'cloudflare'

const importableProjects = computed(() => projects.value.filter(
  (project: CloudflareProject) => !isProjectImported(project)
))

const selectAll = computed({
  get: () => selectedProjects.value.length === importableProjects.value.length && importableProjects.value.length > 0,
  set: () => {}
})

function normalizeUrl(value: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) return ''

  try {
    const url = new URL(trimmedValue)
    url.hash = ''
    url.hostname = url.hostname.toLowerCase()
    return url.toString().replace(/\/$/, '')
  } catch {
    return trimmedValue.replace(/\/$/, '')
  }
}

function isProjectImported(project: CloudflareProject) {
  return existingSiteUrls.value.has(normalizeUrl(project.url))
}

function toggleSelectAll() {
  if (selectedProjects.value.length === importableProjects.value.length) {
    selectedProjects.value = []
  } else {
    selectedProjects.value = importableProjects.value.map((project: CloudflareProject) => project.id)
  }
}

function toggleProject(project: CloudflareProject) {
  if (isProjectImported(project)) return

  const index = selectedProjects.value.indexOf(project.id)
  if (index > -1) {
    selectedProjects.value.splice(index, 1)
  } else {
    selectedProjects.value.push(project.id)
  }
}

async function fetchExistingSites() {
  await sitesStore.fetchSites()
  existingSiteUrls.value = new Set(
    sitesStore.sites
      .map(site => normalizeUrl(site.url))
      .filter((url: string) => Boolean(url))
  )
}
  
async function fetchProjects() {
  loading.value = true
  error.value = ''

  try {
    const [response] = await Promise.all([
      fetch('/api/cloudflare/projects'),
      fetchExistingSites()
    ])

    const data = await response.json() as {
      success: boolean
      projects?: CloudflareProject[]
      error?: string
    }

    if (data.success && data.projects) {
      projects.value = data.projects
      selectedProjects.value = selectedProjects.value.filter((id: string) => {
        const project = data.projects?.find((item: CloudflareProject) => item.id === id)
        return project ? !isProjectImported(project) : false
      })
    } else {
      error.value = data.error || '获取项目列表失败'
    }
  } catch (err) {
    error.value = '网络错误，请重试'
  } finally {
    loading.value = false
  }
}

async function ensureCloudflareCategory() {
  await sitesStore.fetchCategories()

  const exists = sitesStore.categoryList.some((category: Category) => category.name === cloudflareCategoryName)
  if (exists) return

  const created = await sitesStore.createCategory(cloudflareCategoryName)
  if (created) return

  await sitesStore.fetchCategories()
  const existsAfterRetry = sitesStore.categoryList.some((category: Category) => category.name === cloudflareCategoryName)
  if (!existsAfterRetry) {
    throw new Error('Failed to create Cloudflare category')
  }
}

async function handleImport() {
  if (selectedProjects.value.length === 0) return

  importing.value = true

  try {
    await ensureCloudflareCategory()

    const selectedItems = projects.value.filter((project: CloudflareProject) => (
      selectedProjects.value.includes(project.id) && !isProjectImported(project)
    ))

    for (const project of selectedItems) {
      await sitesStore.createSite({
        name: project.name,
        url: project.url,
        icon: project.type === 'pages'
          ? 'https://pages.cloudflare.com/favicon.ico'
          : 'https://workers.cloudflare.com/favicon.ico',
        category: cloudflareCategoryName,
        description: `Cloudflare ${project.type === 'pages' ? 'Pages' : 'Workers'} 项目`,
        sort: 0
      })
    }

    emit('imported')
    emit('close')
  } catch (err) {
    alert('同步失败，请重试')
  } finally {
    importing.value = false
  }
}

onMounted(() => {
  fetchProjects()
})
</script>

<style scoped>
.import-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--spacing-lg);
}

.import-modal {
  background: white;
  border-radius: var(--radius-lg);
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
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
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: background var(--transition-fast);
}

.btn-close:hover {
  background: rgba(0, 0, 0, 0.1);
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  opacity: 0.6;
}

.error-state p {
  color: #ef4444;
  margin-bottom: var(--spacing-md);
}

.btn-retry {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--primary-color);
  color: white;
  border-radius: var(--radius-md);
  font-weight: 500;
}

.empty-state .hint {
  font-size: 14px;
  margin-top: var(--spacing-sm);
}

.select-all {
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-md);
  background: rgba(0, 0, 0, 0.02);
  border-radius: var(--radius-md);
}

.select-all label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
  font-weight: 500;
}

.projects-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.project-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.project-item:hover {
  border-color: var(--primary-color);
  background: rgba(102, 126, 234, 0.05);
}

.project-item.selected {
  border-color: var(--primary-color);
  background: rgba(102, 126, 234, 0.1);
}

.project-item input[type="checkbox"] {
  margin-top: 2px;
  cursor: pointer;
}

.project-info {
  flex: 1;
}

.project-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.project-name {
  font-weight: 600;
  font-size: 15px;
}

.project-type {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.project-type.pages {
  background: #10b981;
  color: white;
}

.project-type.workers {
  background: #f59e0b;
  color: white;
}

.project-url {
  font-size: 13px;
  opacity: 0.6;
  word-break: break-all;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.btn-cancel,
.btn-import {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: all var(--transition-fast);
}

.btn-cancel {
  background: rgba(0, 0, 0, 0.05);
}

.btn-cancel:hover {
  background: rgba(0, 0, 0, 0.1);
}

.btn-import {
  background: var(--primary-color);
  color: white;
}

.btn-import:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-import:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
