// POST /api/privacy/logout - 退出隐私模式

import { PRIVACY_SESSION_COOKIE, clearSessionCookie } from '../../session'

export const onRequestPost: PagesFunction = async (context) => {
  return Response.json({ success: true }, {
    headers: {
      'Set-Cookie': clearSessionCookie(PRIVACY_SESSION_COOKIE, context.request)
    }
  })
}
