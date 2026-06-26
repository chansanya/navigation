// POST /api/privacy/logout - 退出隐私模式

import { PRIVACY_SESSION_COOKIE, clearSessionCookie } from '../../session'

export const onRequestPost: PagesFunction = async (context) => {
  // 退出隐私模式时清 Cookie，前端会同时隐藏隐私分类并锁定随身记录。
  return Response.json({ success: true }, {
    headers: {
      'Set-Cookie': clearSessionCookie(PRIVACY_SESSION_COOKIE, context.request)
    }
  })
}
