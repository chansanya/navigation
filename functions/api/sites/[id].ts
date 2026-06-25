// PUT /api/sites/:id - 更新站点（需认证）
// DELETE /api/sites/:id - 删除站点（需认证）

import {
  deleteSite,
  findSiteByUrl,
  getSiteById,
  isPrivateCategory,
  isValidHttpUrl,
  normalizeUrlInput,
  normalizeUrlForCompare,
  updateSite
} from '../../db'

interface Env {
  DB: D1Database
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  // 更新站点同时影响首页展示和管理数据，必须先通过管理员认证。
  if (!context.data.isAuthenticated) {
    return Response.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  try {
    const id = parseInt(context.params.id as string)
    if (isNaN(id)) {
      return Response.json({
        success: false,
        error: 'Invalid site ID'
      }, { status: 400 })
    }

    // 先读取旧记录，后续隐私权限和 URL 查重都需要对比当前值。
    const existing = await getSiteById(context.env.DB, id)
    if (!existing) {
      return Response.json({
        success: false,
        error: 'Site not found'
      }, { status: 404 })
    }

    const data = await context.request.json() as any

    if (data.url !== undefined) {
      const url = normalizeUrlInput(data.url)

      if (!url || !isValidHttpUrl(url)) {
        return Response.json({
          success: false,
          error: 'Invalid URL'
        }, { status: 400 })
      }

      // URL 未变化时跳过查重：库里可能存在归一化相同的其它记录（如尾斜杠差异），
      // 不应据此拦截对当前站点自身的编辑
      if (normalizeUrlForCompare(url) !== normalizeUrlForCompare(existing.url)) {
        const duplicated = await findSiteByUrl(context.env.DB, url, id)
        if (duplicated) {
          return Response.json({
            success: false,
            error: '该站点已存在，不能重复添加'
          }, { status: 409 })
        }
      }

      data.url = url
    }

    // 只要原分类或目标分类涉及隐私空间，都要求当前会话已解锁隐私模式。
    if ((isPrivateCategory(existing.category) || isPrivateCategory(data.category)) && !context.data.isPrivacyUnlocked) {
      return Response.json({
        success: false,
        error: 'Privacy mode required'
      }, { status: 403 })
    }

    const site = await updateSite(context.env.DB, id, data)

    return Response.json({
      success: true,
      site
    })
  } catch (error) {
    return Response.json({
      success: false,
      error: 'Failed to update site'
    }, { status: 500 })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  // 删除是不可逆操作，必须先通过管理员认证。
  if (!context.data.isAuthenticated) {
    return Response.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  try {
    const id = parseInt(context.params.id as string)
    if (isNaN(id)) {
      return Response.json({
        success: false,
        error: 'Invalid site ID'
      }, { status: 400 })
    }

    // 删除前确认记录存在，避免前端把重复点击误判为成功。
    const existing = await getSiteById(context.env.DB, id)
    if (!existing) {
      return Response.json({
        success: false,
        error: 'Site not found'
      }, { status: 404 })
    }

    // 删除隐私空间站点同样需要隐私模式，避免只凭管理认证误删。
    if (isPrivateCategory(existing.category) && !context.data.isPrivacyUnlocked) {
      return Response.json({
        success: false,
        error: 'Privacy mode required'
      }, { status: 403 })
    }

    await deleteSite(context.env.DB, id)

    return Response.json({
      success: true
    })
  } catch (error) {
    return Response.json({
      success: false,
      error: 'Failed to delete site'
    }, { status: 500 })
  }
}
