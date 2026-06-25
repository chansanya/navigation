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
    const nextName = typeof body.name === 'string' ? body.name.trim() : undefined

    if (!nextName && body.sort === undefined) {
      return Response.json({
        success: false,
        error: 'Missing name or sort'
      }, { status: 400 })
    }

    const existingCategory = await context.env.DB.prepare('SELECT name FROM categories WHERE id = ?').bind(id).first<{ name: string }>()
    if (!existingCategory) {
      return Response.json({
        success: false,
        error: 'Category not found'
      }, { status: 404 })
    }

    // 涉及隐私空间的分类改名或排序必须先进入隐私模式。
    if ((isPrivateCategory(existingCategory.name) || isPrivateCategory(nextName)) && !context.data.isPrivacyUnlocked) {
      return Response.json({
        success: false,
        error: 'Privacy mode required'
      }, { status: 403 })
    }

    if (nextName && nextName !== existingCategory.name) {
      const duplicate = await context.env.DB.prepare(
        'SELECT id FROM categories WHERE name = ? AND id != ?'
      ).bind(nextName, id).first()

      if (duplicate) {
        return Response.json({
          success: false,
          error: 'Category already exists'
        }, { status: 400 })
      }
    }

    // 构建更新语句
    // name 和 sort 都是可选字段，避免只拖动排序时必须带分类名。
    const updates: string[] = []
    const params: any[] = []

    if (nextName) {
      updates.push('name = ?')
      params.push(nextName)
    }

    if (body.sort !== undefined) {
      updates.push('sort = ?')
      params.push(body.sort)
    }

    params.push(id)

    await context.env.DB.prepare(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run()

    if (nextName && nextName !== existingCategory.name) {
      // 站点表按分类名关联；分类改名后需要同步已有站点的 category 字段。
      await context.env.DB.prepare(
        'UPDATE sites SET category = ? WHERE category = ?'
      ).bind(nextName, existingCategory.name).run()
    }

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
    // 只允许删除空分类，避免站点变成不可见的孤立分类。
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
