// PUT /api/submissions/:id - 审核投稿（需认证）

import {
  createSite,
  findSiteByUrl,
  getSubmissionById,
  isPrivateCategory,
  isValidHttpUrl,
  normalizeUrlInput,
  updateSubmissionStatus
} from '../../db'

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
    const id = parseInt(context.params.id as string)
    if (Number.isNaN(id)) {
      return Response.json({
        success: false,
        error: 'Invalid submission ID'
      }, { status: 400 })
    }

    const submission = await getSubmissionById(context.env.DB, id)
    if (!submission) {
      return Response.json({
        success: false,
        error: 'Submission not found'
      }, { status: 404 })
    }

    const data = await context.request.json() as any
    const action = data.action === 'reject' ? 'reject' : 'approve'

    if (action === 'reject') {
      const updated = await updateSubmissionStatus(context.env.DB, id, 'rejected', data.review_note)
      return Response.json({
        success: true,
        submission: updated
      })
    }

    const category = typeof data.category === 'string' && data.category.trim()
      ? data.category.trim()
      : submission.category || '其他'

    if (isPrivateCategory(category) && !context.data.isPrivacyUnlocked) {
      return Response.json({
        success: false,
        error: 'Privacy mode required'
      }, { status: 403 })
    }

    const siteUrl = normalizeUrlInput(
      typeof data.url === 'string' && data.url.trim() ? data.url.trim() : submission.url
    )

    if (!isValidHttpUrl(siteUrl)) {
      return Response.json({
        success: false,
        error: 'Invalid URL'
      }, { status: 400 })
    }

    const existing = await findSiteByUrl(context.env.DB, siteUrl)
    if (existing) {
      return Response.json({
        success: false,
        error: '该站点已存在，不能重复收录'
      }, { status: 409 })
    }

    const site = await createSite(context.env.DB, {
      name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : submission.name,
      url: siteUrl,
      icon: typeof data.icon === 'string' ? data.icon.trim() : submission.icon || '',
      category,
      description: typeof data.description === 'string' ? data.description.trim() : submission.description || '',
      sort: typeof data.sort === 'number' ? data.sort : 0
    })
    const updated = await updateSubmissionStatus(context.env.DB, id, 'approved', data.review_note)

    return Response.json({
      success: true,
      site,
      submission: updated
    })
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Failed to review submission'
    }, { status: 500 })
  }
}
