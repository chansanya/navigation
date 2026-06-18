import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { usePrivacyStore } from './privacy'
import type { Site } from './sites'

export interface Shortcut {
  id?: number
  site_id?: number | null
  name: string
  url: string
  icon?: string | null
  sort?: number
  created_at?: string
  updated_at?: string
}

interface ApiResponse {
  success: boolean
  error?: string
}

interface ShortcutsResponse extends ApiResponse {
  shortcuts?: Shortcut[]
}

interface ShortcutResponse extends ApiResponse {
  shortcut?: Shortcut
}

function normalizeUrl(value: string) {
  const trimmed = value.trim()

  if (!trimmed) return ''
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)) return trimmed

  return `https://${trimmed}`
}

function getGoogleFaviconUrl(url: string) {
  try {
    const hostname = new URL(normalizeUrl(url)).hostname
    return hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=128` : ''
  } catch {
    return ''
  }
}

function normalizeShortcutIcon(icon: string | null | undefined) {
  const trimmedIcon = (icon || '').trim()

  if (!trimmedIcon) return null
  if (trimmedIcon.startsWith('/api/icon-proxy')) return trimmedIcon
  if (trimmedIcon.includes('google.com/s2/favicons')) return trimmedIcon
  if (trimmedIcon.startsWith('/') && !trimmedIcon.startsWith('//')) return trimmedIcon
  if (trimmedIcon.startsWith('data:image/')) return trimmedIcon
  if (/^https?:\/\//i.test(trimmedIcon)) {
    return `/api/icon-proxy?url=${encodeURIComponent(trimmedIcon)}`
  }

  return trimmedIcon
}

function getShortcutIcon(icon: string | null | undefined, fallbackUrl: string) {
  return getGoogleFaviconUrl(fallbackUrl) || normalizeShortcutIcon(icon)
}

export const useShortcutsStore = defineStore('shortcuts', () => {
  const shortcuts = ref<Shortcut[]>([])
  const loading = ref(false)
  const error = ref('')

  const shortcutUrls = computed(() => new Set(shortcuts.value.map((shortcut) => normalizeUrl(shortcut.url))))
  const shortcutSiteIds = computed(() => {
    return new Set(shortcuts.value
      .map((shortcut) => shortcut.site_id)
      .filter((siteId): siteId is number => typeof siteId === 'number'))
  })

  async function fetchShortcuts() {
    const privacyStore = usePrivacyStore()
    loading.value = true
    error.value = ''

    try {
      const response = await fetch('/api/shortcuts', {
        headers: privacyStore.privacyHeaders()
      })
      const data = await response.json() as ShortcutsResponse

      if (data.success && data.shortcuts) {
        shortcuts.value = data.shortcuts
      } else {
        error.value = data.error || '获取快捷方式失败'
      }
    } catch (err) {
      error.value = '网络错误'
      console.error('Failed to fetch shortcuts:', err)
    } finally {
      loading.value = false
    }
  }

  async function createShortcut(shortcutData: Shortcut): Promise<boolean> {
    const privacyStore = usePrivacyStore()

    try {
      const response = await fetch('/api/shortcuts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...privacyStore.privacyHeaders()
        },
        body: JSON.stringify(shortcutData)
      })
      const data = await response.json() as ShortcutResponse

      if (data.success && data.shortcut) {
        await fetchShortcuts()
        return true
      }

      error.value = data.error || '创建快捷方式失败'
      return false
    } catch (err) {
      error.value = '网络错误'
      console.error('Failed to create shortcut:', err)
      return false
    }
  }

  async function updateShortcut(id: number, shortcutData: Partial<Shortcut> & Pick<Shortcut, 'name' | 'url'>): Promise<boolean> {
    const privacyStore = usePrivacyStore()

    try {
      const response = await fetch(`/api/shortcuts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...privacyStore.privacyHeaders()
        },
        body: JSON.stringify(shortcutData)
      })
      const data = await response.json() as ShortcutResponse

      if (data.success && data.shortcut) {
        await fetchShortcuts()
        return true
      }

      error.value = data.error || '更新快捷方式失败'
      return false
    } catch (err) {
      error.value = '网络错误'
      console.error('Failed to update shortcut:', err)
      return false
    }
  }

  async function deleteShortcut(id: number): Promise<boolean> {
    const privacyStore = usePrivacyStore()

    try {
      const response = await fetch(`/api/shortcuts/${id}`, {
        method: 'DELETE',
        headers: {
          ...privacyStore.privacyHeaders()
        }
      })
      const data = await response.json() as ApiResponse

      if (data.success) {
        shortcuts.value = shortcuts.value.filter((shortcut) => shortcut.id !== id)
        return true
      }

      error.value = data.error || '删除快捷方式失败'
      return false
    } catch (err) {
      error.value = '网络错误'
      console.error('Failed to delete shortcut:', err)
      return false
    }
  }

  function isSiteShortcut(site: Site) {
    if (site.id && shortcutSiteIds.value.has(site.id)) return true
    return shortcutUrls.value.has(normalizeUrl(site.url))
  }

  function findShortcutBySite(site: Site) {
    return shortcuts.value.find((shortcut) => {
      if (site.id && shortcut.site_id === site.id) return true
      return normalizeUrl(shortcut.url) === normalizeUrl(site.url)
    })
  }

  async function toggleSiteShortcut(site: Site): Promise<boolean> {
    const existing = findShortcutBySite(site)

    if (existing?.id) {
      return deleteShortcut(existing.id)
    }

    return createShortcut({
      site_id: site.id || null,
      name: site.name,
      url: site.url,
      icon: getShortcutIcon(site.icon, site.url),
      sort: site.sort || 0
    })
  }

  return {
    shortcuts,
    loading,
    error,
    fetchShortcuts,
    createShortcut,
    updateShortcut,
    deleteShortcut,
    isSiteShortcut,
    findShortcutBySite,
    toggleSiteShortcut
  }
})
