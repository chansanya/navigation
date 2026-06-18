// PUT /api/shortcuts/:id - 更新快捷方式（需认证）
// DELETE /api/shortcuts/:id - 删除快捷方式（需认证）

import { deleteShortcut, getShortcutById, getSiteById, isPrivateCategory, updateShortcut } from '../../db'

interface Env {
  DB: D1Database
}

function normalizeUrl(value: unknown) {
  if (typeof value !== 'string') return ''

  const trimmed = value.trim()
  if (!trimmed) return ''
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

export const onRequestPut: PagesFunction<Env> = async (context) => {
  if (!context.data.isAuthenticated) {
    return Response.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  try {
    const id = parseInt(context.params.id as string)
    if (Number.isNaN(id)) {
      return Response.json({
        success: false,
        error: 'Invalid shortcut ID'
      }, { status: 400 })
    }

    const existing = await getShortcutById(context.env.DB, id)
    if (!existing) {
      return Response.json({
        success: false,
        error: 'Shortcut not found'
      }, { status: 404 })
    }

    if (existing.site_id) {
      const site = await getSiteById(context.env.DB, existing.site_id)
      if (isPrivateCategory(site?.category) && !context.data.isPrivacyUnlocked) {
        return Response.json({
          success: false,
          error: 'Privacy mode required'
        }, { status: 403 })
      }
    }

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

    const shortcut = await updateShortcut(context.env.DB, id, {
      name,
      url,
      icon: typeof data.icon === 'string' ? data.icon : existing.icon,
      sort: typeof data.sort === 'number' ? data.sort : existing.sort
    })

    return Response.json({
      success: true,
      shortcut
    })
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Failed to update shortcut'
    }, { status: 500 })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  if (!context.data.isAuthenticated) {
    return Response.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  try {
    const id = parseInt(context.params.id as string)
    if (Number.isNaN(id)) {
      return Response.json({
        success: false,
        error: 'Invalid shortcut ID'
      }, { status: 400 })
    }

    const existing = await getShortcutById(context.env.DB, id)
    if (!existing) {
      return Response.json({
        success: false,
        error: 'Shortcut not found'
      }, { status: 404 })
    }

    if (existing.site_id) {
      const site = await getSiteById(context.env.DB, existing.site_id)
      if (isPrivateCategory(site?.category) && !context.data.isPrivacyUnlocked) {
        return Response.json({
          success: false,
          error: 'Privacy mode required'
        }, { status: 403 })
      }
    }

    await deleteShortcut(context.env.DB, id)

    return Response.json({
      success: true
    })
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Failed to delete shortcut'
    }, { status: 500 })
  }
}
