// GET /api/settings - 获取全局设置（公开）
// PUT /api/settings - 更新设置（需认证）

import { getSettings, updateSetting } from '../../db'

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // 设置公开读取，用于未认证访客也能拿到主题、背景和站点标题。
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
  // 外观设置会影响所有访客，只允许管理员会话写入。
  if (!context.data.isAuthenticated) {
    return Response.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  try {
    const data = await context.request.json() as any

    // PUT 允许部分字段更新，未传字段保持原值，方便各设置面板独立保存。
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

    // 返回更新后的完整设置，让前端拿到服务端归一化后的最终配置。
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
