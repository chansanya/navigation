// POST /api/auth/logout - 退出管理员会话

import { ADMIN_SESSION_COOKIE, clearSessionCookie } from '../../session'

export const onRequestPost: PagesFunction = async (context) => {
  return Response.json({ success: true }, {
    headers: {
      'Set-Cookie': clearSessionCookie(ADMIN_SESSION_COOKIE, context.request)
    }
  })
}
