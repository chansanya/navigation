// GET /api/sites - 获取所有站点（公开）
// POST /api/sites - 创建站点（需认证）

import {
  createSite,
  findSiteByUrl,
  getSites,
  isPrivateCategory,
  isValidHttpUrl,
  normalizeUrlInput
} from '../../db'

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // 调试：检查 DB 是否存在
    if (!context.env.DB) {
      return Response.json({
        success: false,
        error: 'Database not bound'
      }, { status: 500 })
    }

    const url = new URL(context.request.url)
    const category = url.searchParams.get('category') || undefined

    const sites = await getSites(context.env.DB, category, Boolean(context.data.isPrivacyUnlocked))

    return Response.json({
      success: true,
      sites
    })
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Failed to fetch sites'
    }, { status: 500 })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  // 检查认证
  if (!context.data.isAuthenticated) {
    return Response.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  try {
    const data = await context.request.json() as any
    const name = typeof data.name === 'string' ? data.name.trim() : ''
    const url = normalizeUrlInput(data.url)

    // 验证必填字段
    if (!name || !url) {
      return Response.json({
        success: false,
        error: 'Name and URL are required'
      }, { status: 400 })
    }

    if (!isValidHttpUrl(url)) {
      return Response.json({
        success: false,
        error: 'Invalid URL'
      }, { status: 400 })
    }

    if (isPrivateCategory(data.category) && !context.data.isPrivacyUnlocked) {
      return Response.json({
        success: false,
        error: 'Privacy mode required'
      }, { status: 403 })
    }

    const existing = await findSiteByUrl(context.env.DB, url)
    if (existing) {
      return Response.json({
        success: false,
        error: '该站点已存在，不能重复添加'
      }, { status: 409 })
    }

    const site = await createSite(context.env.DB, {
      ...data,
      name,
      url
    })

    return Response.json({
      success: true,
      site
    })
  } catch (error) {
    return Response.json({
      success: false,
      error: 'Failed to create site'
    }, { status: 500 })
  }
}
