// GET /api/sites/check-url?url=<url>&excludeId=<id> - 检查站点 URL 是否已存在

import {
  findPendingSubmissionByUrl,
  findSiteByUrl,
  isValidHttpUrl,
  normalizeUrlInput
} from '../../db'

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const requestUrl = new URL(context.request.url)
    const url = normalizeUrlInput(requestUrl.searchParams.get('url'))
    const excludeIdValue = requestUrl.searchParams.get('excludeId')
    const excludeId = excludeIdValue ? Number(excludeIdValue) : undefined
    const includePending = requestUrl.searchParams.get('includePending') === '1'

    if (!url) {
      return Response.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 })
    }

    if (!isValidHttpUrl(url)) {
      return Response.json({
        success: false,
        error: 'Invalid URL'
      }, { status: 400 })
    }

    // 编辑已有站点时通过 excludeId 排除自身，避免 URL 未变也被判定重复。
    const existingSite = await findSiteByUrl(
      context.env.DB,
      url,
      Number.isFinite(excludeId) ? excludeId : undefined
    )

    if (existingSite) {
      return Response.json({
        success: true,
        exists: true,
        source: 'site'
      })
    }

    if (!includePending) {
      return Response.json({
        success: true,
        exists: false,
        source: null
      })
    }

    // 投稿入口需要同时检查待审核队列，避免同一个站点反复提交。
    const pendingSubmission = await findPendingSubmissionByUrl(context.env.DB, url)

    return Response.json({
      success: true,
      exists: Boolean(pendingSubmission),
      source: pendingSubmission ? 'submission' : null
    })
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Failed to check URL'
    }, { status: 500 })
  }
}
