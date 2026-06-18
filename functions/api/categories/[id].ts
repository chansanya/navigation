// PUT /api/categories/:id - 更新分类

import { isPrivateCategory, PRIVATE_CATEGORY_NAME } from '../../db'

interface Env {
  DB: D1Database
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  if (!context.data.isAuthenticated) {
    return Response.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  try {
    const id = context.params.id as string
    const body = await context.request.json() as { name?: string; sort?: number }

    if (!body.name && body.sort === undefined) {
      return Response.json({
        success: false,
        error: 'Missing name or sort'
      }, { status: 400 })
    }

    if (isPrivateCategory(body.name) && !context.data.isPrivacyUnlocked) {
      return Response.json({
        success: false,
        error: 'Privacy mode required'
      }, { status: 403 })
    }

    // 构建更新语句
    const updates: string[] = []
    const params: any[] = []

    if (body.name) {
      updates.push('name = ?')
      params.push(body.name)
    }

    if (body.sort !== undefined) {
      updates.push('sort = ?')
      params.push(body.sort)
    }

    params.push(id)

    await context.env.DB.prepare(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run()

    return Response.json({
      success: true
    })
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// DELETE /api/categories/:id - 删除分类
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  if (!context.data.isAuthenticated) {
    return Response.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  try {
    const id = context.params.id as string

    const category = await context.env.DB.prepare('SELECT name FROM categories WHERE id = ?').bind(id).first<{ name: string }>()
    if (category?.name === PRIVATE_CATEGORY_NAME) {
      return Response.json({
        success: false,
        error: 'Private category cannot be deleted'
      }, { status: 400 })
    }

    // 检查分类下是否有站点
    const siteCount = await context.env.DB.prepare(
      'SELECT COUNT(*) as count FROM sites WHERE category = (SELECT name FROM categories WHERE id = ?)'
    ).bind(id).first()

    if (siteCount && (siteCount.count as number) > 0) {
      return Response.json({
        success: false,
        error: 'Cannot delete category with sites'
      }, { status: 400 })
    }

    // 删除分类
    await context.env.DB.prepare(
      'DELETE FROM categories WHERE id = ?'
    ).bind(id).run()

    return Response.json({
      success: true
    })
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
