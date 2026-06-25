// GET /api/shortcuts - 获取快捷方式（公开）
// POST /api/shortcuts - 创建快捷方式（需认证）

import { createShortcut, getShortcuts, getSiteById, isPrivateCategory } from '../../db'

interface Env {
  DB: D1Database
}

function normalizeUrl(value: unknown) {
  if (typeof value !== 'string') return ''

  const trimmed = value.trim()
  if (!trimmed) return ''
  // 快捷方式允许站内相对路径或锚点，方便把内部页面也放到搜索首页。
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)) return trimmed

  return `https://${trimmed}`
}

function isValidUrl(value: string) {
  if (value.startsWith('/') || value.startsWith('#')) return true

  try {
    const parsedUrl = new URL(value)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // 未进入隐私模式时，关联隐私空间站点的快捷方式会在 db 层被过滤。
    const shortcuts = await getShortcuts(context.env.DB, Boolean(context.data.isPrivacyUnlocked))

    return Response.json({
      success: true,
      shortcuts
    })
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Failed to fetch shortcuts'
    }, { status: 500 })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!context.data.isAuthenticated) {
    return Response.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  try {
    const data = await context.request.json() as any
    const name = typeof data.name === 'string' ? data.name.trim() : ''
    const url = normalizeUrl(data.url)

    if (!name || !url) {
      return Response.json({
        success: false,
        error: 'Name and URL are required'
      }, { status: 400 })
    }

    if (!isValidUrl(url)) {
      return Response.json({
        success: false,
        error: 'Invalid URL'
      }, { status: 400 })
    }

    const siteId = typeof data.site_id === 'number' ? data.site_id : null
    if (siteId) {
      // 从隐私站点创建快捷方式时，需要确认当前会话能看到该站点。
      const site = await getSiteById(context.env.DB, siteId)
      if (isPrivateCategory(site?.category) && !context.data.isPrivacyUnlocked) {
        return Response.json({
          success: false,
          error: 'Privacy mode required'
        }, { status: 403 })
      }
    }

    const shortcut = await createShortcut(context.env.DB, {
      site_id: siteId,
      name,
      url,
      icon: typeof data.icon === 'string' ? data.icon : null,
      sort: typeof data.sort === 'number' ? data.sort : 0
    })

    return Response.json({
      success: true,
      shortcut
    })
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Failed to create shortcut'
    }, { status: 500 })
  }
}
