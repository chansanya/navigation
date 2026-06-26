// POST /api/privacy/verify - 验证隐私空间密码

import { checkRateLimitBlock, clearRateLimit, recordRateLimitFailure } from '../../db'
import { PRIVACY_SESSION_COOKIE, clearSessionCookie, createSignedSessionCookie } from '../../session'
import { createRateLimitKey, createRateLimitResponse, readLimitedRequestJson, timingSafeEqualText } from '../../security'

interface Env {
  DB: D1Database
  PRIVATE_PASSWORD?: string
}

const privacyRateLimit = {
  limit: 5,
  windowMs: 10 * 60 * 1000,
  blockMs: 15 * 60 * 1000
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const rateLimitKey = await createRateLimitKey('privacy_verify', context.request)
  const blockState = await checkRateLimitBlock(context.env.DB, rateLimitKey)
  if (!blockState.allowed) {
    return createRateLimitResponse(blockState.retryAfterSeconds)
  }

  try {
    const data = await readLimitedRequestJson(context.request, 1024)
    const privatePassword = context.env.PRIVATE_PASSWORD || ''
    // 未配置隐私密码时不允许解锁，避免空密码成为默认后门。
    const password = typeof data.password === 'string' ? data.password : ''
    const valid = Boolean(privatePassword) && await timingSafeEqualText(password, privatePassword)

    if (!valid) {
      const failureState = await recordRateLimitFailure(context.env.DB, rateLimitKey, privacyRateLimit)
      if (!failureState.allowed) {
        const response = createRateLimitResponse(failureState.retryAfterSeconds)
        response.headers.append('Set-Cookie', clearSessionCookie(PRIVACY_SESSION_COOKIE, context.request))
        return response
      }

      // 解锁失败时清掉旧隐私 Cookie，确保前端刷新后也不会误显示隐私空间。
      return Response.json({ valid: false }, {
        headers: {
          'Set-Cookie': clearSessionCookie(PRIVACY_SESSION_COOKIE, context.request)
        }
      })
    }

    await clearRateLimit(context.env.DB, rateLimitKey)

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
