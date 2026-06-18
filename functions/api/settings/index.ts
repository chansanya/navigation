// GET /api/settings - 获取全局设置（公开）
// PUT /api/settings - 更新设置（需认证）

import { getSettings, updateSetting } from '../../db'

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const settings = await getSettings(context.env.DB)

    return Response.json({
      success: true,
      settings
    })
  } catch (error) {
    return Response.json({
      success: false,
      error: 'Failed to fetch settings'
    }, { status: 500 })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  // 检查认证
  if (!context.data.isAuthenticated) {
    return Response.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  try {
    const data = await context.request.json() as any

    // 更新每个提供的设置项
    if (data.siteTitle !== undefined) {
      await updateSetting(context.env.DB, 'siteTitle', data.siteTitle)
    }
    if (data.siteLogo !== undefined) {
      await updateSetting(context.env.DB, 'siteLogo', data.siteLogo)
    }
    if (data.theme !== undefined) {
      await updateSetting(context.env.DB, 'theme', data.theme)
    }
    if (data.background !== undefined) {
      await updateSetting(context.env.DB, 'background', data.background)
    }
    if (data.appearance !== undefined) {
      await updateSetting(context.env.DB, 'appearance', data.appearance)
    }
    if (data.presets !== undefined) {
      await updateSetting(context.env.DB, 'presets', data.presets)
    }

    // 返回更新后的设置
    const settings = await getSettings(context.env.DB)

    return Response.json({
      success: true,
      settings
    })
  } catch (error) {
    return Response.json({
      success: false,
      error: 'Failed to update settings'
    }, { status: 500 })
  }
}
