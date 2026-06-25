// POST /api/auth/verify - 验证管理员 token

import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS, clearSessionCookie, createSignedSessionCookie } from '../../session'

interface Env {
  ADMIN_TOKEN: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { token } = await context.request.json() as { token: string }
    const validToken = context.env.ADMIN_TOKEN || ''
    // 管理令牌只和环境变量比较，成功后下发签名 Cookie，不把令牌回传给前端。
    const valid = token === validToken && token.length > 0

    if (!valid) {
      // 校验失败时主动清掉旧 Cookie，避免用户继续停留在过期或错误状态。
      return Response.json({ valid: false }, {
        headers: {
          'Set-Cookie': clearSessionCookie(ADMIN_SESSION_COOKIE, context.request)
        }
      })
    }

    return Response.json({ valid: true }, {
      headers: {
        // 管理会话有固定过期时间，减少长期共享设备上的误授权风险。
        'Set-Cookie': await createSignedSessionCookie(
          ADMIN_SESSION_COOKIE,
          validToken,
          context.request,
          ADMIN_SESSION_MAX_AGE_SECONDS
        )
      }
    })
  } catch (error) {
    return Response.json({
      valid: false,
      error: 'Invalid request'
    }, { status: 400 })
  }
}
