// POST /api/auth/logout - 退出管理员会话

import { ADMIN_SESSION_COOKIE, clearSessionCookie } from '../../session'

export const onRequestPost: PagesFunction = async (context) => {
  // 退出只需要覆盖同名 Cookie 为 Max-Age=0，前端状态由 auth store 同步清理。
  return Response.json({ success: true }, {
    headers: {
      'Set-Cookie': clearSessionCookie(ADMIN_SESSION_COOKIE, context.request)
    }
  })
}
