// POST /api/integrations/myapp/passive/preview - 预检同步本地随身记录到 MyApp

import { previewMyAppPassiveSync } from '../../../../integrations/myapp'
import { readLimitedRequestJson } from '../../../../security'

interface Env {
  MYAPP_BASE_URL?: string
  MYAPP_EXPORT_KEY?: string
  MYAPP_PAYLOAD_KEY_PREFIX?: string
  MYAPP_SYNC_SOURCE?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!context.data.isAuthenticated) {
    return Response.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  if (!context.data.isPrivacyUnlocked) {
    return Response.json({
      success: false,
      error: 'Privacy mode required'
    }, { status: 403 })
  }

  try {
    const body = await readLimitedRequestJson(context.request, 1024 * 1024)
    const result = await previewMyAppPassiveSync(
      body.records,
      context.env.MYAPP_BASE_URL,
      context.env.MYAPP_EXPORT_KEY,
      context.env.MYAPP_PAYLOAD_KEY_PREFIX,
      context.env.MYAPP_SYNC_SOURCE
    )

    return Response.json({
      success: true,
      ...result.preview,
      upload: result.upload
    })
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'MyApp 被动同步预检失败'
    }, { status: 400 })
  }
}
