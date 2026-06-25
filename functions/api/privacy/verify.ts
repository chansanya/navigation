// POST /api/privacy/verify - 验证隐私空间密码

import { PRIVACY_SESSION_COOKIE, clearSessionCookie, createSignedSessionCookie } from '../../session'

interface Env {
  PRIVATE_PASSWORD?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const data = await context.request.json() as { password?: string }
    const privatePassword = context.env.PRIVATE_PASSWORD || ''
    // 未配置隐私密码时不允许解锁，避免空密码成为默认后门。
    const valid = Boolean(privatePassword) && data.password === privatePassword

    if (!valid) {
      // 解锁失败时清掉旧隐私 Cookie，确保前端刷新后也不会误显示隐私空间。
      return Response.json({ valid: false }, {
        headers: {
          'Set-Cookie': clearSessionCookie(PRIVACY_SESSION_COOKIE, context.request)
        }
      })
    }

    return Response.json({ valid: true }, {
      headers: {
        // 隐私 Cookie 不设置 Max-Age，默认随浏览器会话结束失效。
        'Set-Cookie': await createSignedSessionCookie(PRIVACY_SESSION_COOKIE, privatePassword, context.request)
      }
    })
  } catch {
    return Response.json({ valid: false })
  }
}
