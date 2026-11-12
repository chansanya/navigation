// POST /api/sites/extract - 从 URL 自动提取站点信息

import { consumeRateLimit } from '../../db'
import {
  createErrorResponse,
  createRateLimitResponse,
  createRateLimitKey,
  readLimitedRequestJson
} from '../../security'
import { extractSiteInfo } from '../../services/site-extractor'

interface Env {
  DB: D1Database
}

const requestMaxBytes = 2048
const publicRateLimit = {
  limit: 30,
  windowMs: 10 * 60 * 1000,
  blockMs: 10 * 60 * 1000
}

async function enforceRateLimit(context: EventContext<Env, string, Record<string, unknown>>) {
  const key = await createRateLimitKey('sites_extract', context.request)
  const result = await consumeRateLimit(context.env.DB, key, publicRateLimit)
  if (!result.allowed) {
    return createRateLimitResponse(result.retryAfterSeconds)
  }

  return null
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const rateLimitResponse = await enforceRateLimit(context)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await readLimitedRequestJson(context.request, requestMaxBytes)
    const { info } = await extractSiteInfo(body.url)

    return Response.json({
      success: true,
      info
    })
  } catch (error) {
    return createErrorResponse(error, 'Failed to extract site info')
  }
}
