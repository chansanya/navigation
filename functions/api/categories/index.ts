// GET /api/categories - 获取所有分类

import { getCategories, isPrivateCategory } from '../../db'

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const categories = await getCategories(context.env.DB, Boolean(context.data.isPrivacyUnlocked))

    return Response.json({
      success: true,
      categories
    })
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// POST /api/categories - 创建分类
export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!context.data.isAuthenticated) {
    return Response.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  try {
    const body = await context.request.json() as { name: string }

    if (!body.name) {
      return Response.json({
        success: false,
        error: 'Missing name'
      }, { status: 400 })
    }

    if (isPrivateCategory(body.name) && !context.data.isPrivacyUnlocked) {
      return Response.json({
        success: false,
        error: 'Privacy mode required'
      }, { status: 403 })
    }

    // 检查分类是否已存在
    const existing = await context.env.DB.prepare(
      'SELECT id FROM categories WHERE name = ?'
    ).bind(body.name).first()

    if (existing) {
      return Response.json({
        success: false,
        error: 'Category already exists'
      }, { status: 400 })
    }

    // 获取最大 sort 值
    const maxSort = await context.env.DB.prepare(
      'SELECT MAX(sort) as max_sort FROM categories'
    ).first()

    const newSort = (maxSort?.max_sort as number || 0) + 10

    await context.env.DB.prepare(
      'INSERT INTO categories (name, sort) VALUES (?, ?)'
    ).bind(body.name, newSort).run()

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
