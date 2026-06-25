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
    // D1 绑定缺失时直接返回明确错误，便于部署后快速定位 wrangler/pages 配置问题。
    if (!context.env.DB) {
      return Response.json({
        success: false,
        error: 'Database not bound'
      }, { status: 500 })
    }

    const url = new URL(context.request.url)
    const category = url.searchParams.get('category') || undefined

    // getSites 会根据隐私模式自动过滤隐私空间站点。
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
  // 新增站点会写入公共数据，必须先通过管理员认证。
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

    // 名称和 URL 在服务端再次校验，防止绕过前端表单直接提交脏数据。
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

    // 新建到隐私空间时必须先解锁隐私模式。
    if (isPrivateCategory(data.category) && !context.data.isPrivacyUnlocked) {
      return Response.json({
        success: false,
        error: 'Privacy mode required'
      }, { status: 403 })
    }

    // 创建时做 URL 归一化查重，避免尾斜杠或大小写造成重复站点。
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
