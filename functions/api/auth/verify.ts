// POST /api/auth/verify - 验证管理员 token

import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS, clearSessionCookie, createSignedSessionCookie } from '../../session'

interface Env {
  ADMIN_TOKEN: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { token } = await context.request.json() as { token: string }
    const validToken = context.env.ADMIN_TOKEN || ''
    const valid = token === validToken && token.length > 0

    if (!valid) {
      return Response.json({ valid: false }, {
        headers: {
          'Set-Cookie': clearSessionCookie(ADMIN_SESSION_COOKIE, context.request)
        }
      })
    }

    return Response.json({ valid: true }, {
      headers: {
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
