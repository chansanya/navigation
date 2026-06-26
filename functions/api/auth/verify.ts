// POST /api/auth/verify - 验证管理员 token

import { checkRateLimitBlock, clearRateLimit, recordRateLimitFailure } from '../../db'
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS, clearSessionCookie, createSignedSessionCookie } from '../../session'
import { createRateLimitKey, createRateLimitResponse, readLimitedRequestJson, timingSafeEqualText } from '../../security'

interface Env {
  DB: D1Database
  ADMIN_TOKEN: string
}

const authRateLimit = {
  limit: 5,
  windowMs: 10 * 60 * 1000,
  blockMs: 15 * 60 * 1000
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const rateLimitKey = await createRateLimitKey('auth_verify', context.request)
  const blockState = await checkRateLimitBlock(context.env.DB, rateLimitKey)
  if (!blockState.allowed) {
    return createRateLimitResponse(blockState.retryAfterSeconds)
  }

  try {
    const data = await readLimitedRequestJson(context.request, 1024)
    const token = typeof data.token === 'string' ? data.token : ''
    const validToken = context.env.ADMIN_TOKEN || ''
    // 管理令牌只和环境变量比较，成功后下发签名 Cookie，不把令牌回传给前端。
    const valid = token.length > 0 && await timingSafeEqualText(token, validToken)

    if (!valid) {
      const failureState = await recordRateLimitFailure(context.env.DB, rateLimitKey, authRateLimit)
      if (!failureState.allowed) {
        const response = createRateLimitResponse(failureState.retryAfterSeconds)
        response.headers.append('Set-Cookie', clearSessionCookie(ADMIN_SESSION_COOKIE, context.request))
        return response
      }

      // 校验失败时主动清掉旧 Cookie，避免用户继续停留在过期或错误状态。
      return Response.json({ valid: false }, {
        headers: {
          'Set-Cookie': clearSessionCookie(ADMIN_SESSION_COOKIE, context.request)
        }
      })
    }

    await clearRateLimit(context.env.DB, rateLimitKey)

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
