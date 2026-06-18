// POST /api/privacy/verify - 验证隐私空间密码

import { PRIVACY_SESSION_COOKIE, clearSessionCookie, createSignedSessionCookie } from '../../session'

interface Env {
  PRIVATE_PASSWORD?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const data = await context.request.json() as { password?: string }
    const privatePassword = context.env.PRIVATE_PASSWORD || ''
    const valid = Boolean(privatePassword) && data.password === privatePassword

    if (!valid) {
      return Response.json({ valid: false }, {
        headers: {
          'Set-Cookie': clearSessionCookie(PRIVACY_SESSION_COOKIE, context.request)
        }
      })
    }

    return Response.json({ valid: true }, {
      headers: {
        'Set-Cookie': await createSignedSessionCookie(PRIVACY_SESSION_COOKIE, privatePassword, context.request)
      }
    })
  } catch {
    return Response.json({ valid: false })
  }
}
