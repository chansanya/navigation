// GET /api/submissions - 获取待审核投稿（需认证）
// POST /api/submissions - 提交精品站点推荐（公开）

import {
  createSubmission,
  findPendingSubmissionByUrl,
  findSiteByUrl,
  getSubmissions,
  isPrivateCategory,
  isValidHttpUrl,
  normalizeUrlInput
} from '../../db'

interface Env {
  DB: D1Database
}

function isValidEmail(value: string) {
  // 投稿只需要基础邮箱格式校验，用于后续人工联系，不做复杂 MX 检查。
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!context.data.isAuthenticated) {
    return Response.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  try {
    const url = new URL(context.request.url)
    const status = url.searchParams.get('status') || 'pending'
    const submissions = await getSubmissions(context.env.DB, status)

    return Response.json({
      success: true,
      submissions
    })
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Failed to fetch submissions'
    }, { status: 500 })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const data = await context.request.json() as any
    const name = typeof data.name === 'string' ? data.name.trim() : ''
    const url = normalizeUrlInput(data.url)
    const email = typeof data.email === 'string' ? data.email.trim() : ''
    const category = typeof data.category === 'string' && data.category.trim() ? data.category.trim() : '其他'

    if (!name || !url || !email) {
      return Response.json({
        success: false,
        error: 'Name, URL and email are required'
      }, { status: 400 })
    }

    if (!isValidHttpUrl(url)) {
      return Response.json({
        success: false,
        error: 'Invalid URL'
      }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return Response.json({
        success: false,
        error: 'Invalid email'
      }, { status: 400 })
    }

    // 公开投稿先检查正式站点，避免把已收录站点再次放进审核队列。
    const existing = await findSiteByUrl(context.env.DB, url)
    if (existing) {
      return Response.json({
        success: false,
        error: '该站点已收录，请勿重复提交'
      }, { status: 409 })
    }

    // 再检查待审核投稿，避免重复提交造成审核噪音。
    const pending = await findPendingSubmissionByUrl(context.env.DB, url)
    if (pending) {
      return Response.json({
        success: false,
        error: '该站点已提交审核，请勿重复提交'
      }, { status: 409 })
    }

    const submission = await createSubmission(context.env.DB, {
      name,
      url,
      email,
      // 公开投稿不能直接进入隐私空间，管理员审核时再决定是否收录到隐私分类。
      category: isPrivateCategory(category) ? '其他' : category,
      icon: typeof data.icon === 'string' ? data.icon.trim() : null,
      description: typeof data.description === 'string' ? data.description.trim() : null
    })

    return Response.json({
      success: true,
      submission
    })
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Failed to submit site'
    }, { status: 500 })
  }
}
