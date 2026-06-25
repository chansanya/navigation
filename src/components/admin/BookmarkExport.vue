<template>
  <button
    v-if="authStore.isAuthenticated"
    type="button"
    class="btn-admin btn-export-bookmarks"
    title="导出书签"
    aria-label="导出书签"
    :disabled="exporting"
    @click="handleExport"
  >
    <AppIcon name="bookmarkExport" />
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSitesStore } from '@/stores/sites'
import type { Category, Site } from '@/stores/sites'
import { useAuthStore } from '@/stores/auth'
import AppIcon from '@/components/common/AppIcon.vue'

const sitesStore = useSitesStore()
const authStore = useAuthStore()
const exporting = ref(false)

// HTML 属性与文本转义
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// 仅保留可直接放进 ICON 属性的图标：data URI 或 http(s) URL
function resolveIcon(icon?: string) {
  const trimmed = (icon || '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('data:image/')) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return ''
}

function escapeAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function formatTimestamp(date?: string) {
  // Netscape Bookmark HTML 使用秒级 Unix 时间戳。
  if (!date) return String(Math.floor(Date.now() / 1000))
  const time = new Date(date).getTime()
  return Number.isNaN(time) ? String(Math.floor(Date.now() / 1000)) : String(Math.floor(time / 1000))
}

function buildBookmarkHtml(sites: Site[], categories: Category[]) {
  const now = Math.floor(Date.now() / 1000)

  // 按分类分组，沿用分类排序
  const sortedCategories = [...categories].sort((a, b) => b.sort - a.sort)
  const grouped = new Map<string, Site[]>()
  for (const category of sortedCategories) {
    grouped.set(category.name, [])
  }
  for (const site of sites) {
    const key = site.category || '其他'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(site)
  }

  const lines: string[] = [
    // 使用 Chrome/Firefox 都能识别的 Netscape Bookmark HTML 格式。
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
    `    <DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}" PERSONAL_TOOLBAR_FOLDER="true">书签栏</H3>`,
    '    <DL><p>'
  ]

  grouped.forEach((categorySites, categoryName) => {
    const sortedSites = [...categorySites].sort((a, b) => (b.sort || 0) - (a.sort || 0))
    lines.push(`        <DT><H3 ADD_DATE="${now}">${escapeHtml(categoryName)}</H3>`)
    lines.push('        <DL><p>')
    for (const site of sortedSites) {
      const icon = resolveIcon(site.icon)
      const iconAttr = icon ? ` ICON="${escapeAttr(icon)}"` : ''
      const addDate = formatTimestamp(site.created_at)
      const name = site.name || site.url
      lines.push(`            <DT><A HREF="${escapeAttr(site.url)}" ADD_DATE="${addDate}"${iconAttr}>${escapeHtml(name)}</A>`)
    }
    lines.push('        </DL><p>')
  })

  lines.push('    </DL><p>')
  lines.push('</DL><p>')

  return lines.join('\n')
}

function downloadHtml(html: string, filename: string) {
  // 前端直接生成 Blob 下载，导出过程不需要服务端参与。
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function buildFilename() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const d = now.getDate()
  return `bookmarks_${y}_${m}_${d}.html`
}

async function handleExport() {
  exporting.value = true
  try {
    // 确保拿到全量站点与分类
    // 导出是当前数据库快照，先刷新避免导出旧的 Pinia 缓存。
    await Promise.all([sitesStore.fetchSites(), sitesStore.fetchCategories()])
    if (sitesStore.sites.length === 0) {
      alert('暂无站点可导出')
      return
    }
    const html = buildBookmarkHtml(sitesStore.sites, sitesStore.categoryList)
    downloadHtml(html, buildFilename())
  } catch (error) {
    console.error('Export bookmarks failed:', error)
    alert('导出失败，请重试')
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.btn-admin {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-color, currentColor);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.btn-admin:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.08);
}

.btn-admin:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
