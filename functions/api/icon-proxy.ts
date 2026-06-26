// GET /api/icon-proxy?url=<图标URL> - 代理图标请求，绕过防盗链

import { consumeRateLimit } from '../db'
import {
  HttpError,
  createErrorResponse,
  createRateLimitResponse,
  createRateLimitKey,
  fetchWithValidatedRedirects,
  normalizePublicHttpUrl,
  readLimitedResponseBytes
} from '../security'

interface Env {
  DB: D1Database
}

const iconMaxBytes = 256 * 1024
const iconTimeoutMs = 5000
const publicRateLimit = {
  limit: 30,
  windowMs: 10 * 60 * 1000,
  blockMs: 10 * 60 * 1000
}

function isImageResponse(response: Response) {
  const contentType = response.headers.get('Content-Type')
  return Boolean(contentType && contentType.toLowerCase().startsWith('image/'))
}

async function fetchIconBytes(iconUrl: URL) {
  const { response } = await fetchWithValidatedRedirects(iconUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache'
    }
  }, {
    timeoutMs: iconTimeoutMs,
    maxRedirects: 3
  })

  if (!response.ok) {
    throw new HttpError(404, '图标加载失败')
  }

  if (!isImageResponse(response)) {
    throw new HttpError(415, '目标不是图片')
  }

  return {
    bytes: await readLimitedResponseBytes(response, iconMaxBytes),
    contentType: response.headers.get('Content-Type') || 'image/x-icon'
  }
}

async function enforceRateLimit(context: EventContext<Env, string, Record<string, unknown>>) {
  const key = await createRateLimitKey('icon_proxy', context.request)
  const result = await consumeRateLimit(context.env.DB, key, publicRateLimit)
  if (!result.allowed) {
    return createRateLimitResponse(result.retryAfterSeconds)
  }

  return null
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const rateLimitResponse = await enforceRateLimit(context)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const url = new URL(context.request.url)
    const iconUrl = normalizePublicHttpUrl(url.searchParams.get('url') || '')

    try {
      const icon = await fetchIconBytes(iconUrl)
      return new Response(icon.bytes, {
        headers: {
          'Content-Type': icon.contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (error) {
      if (error instanceof HttpError && error.status !== 404) {
        throw error
      }

      const fallbackUrl = normalizePublicHttpUrl(`https://icons.duckduckgo.com/ip3/${iconUrl.hostname}.ico`)
      const fallbackIcon = await fetchIconBytes(fallbackUrl)
      return new Response(fallbackIcon.bytes, {
        headers: {
          'Content-Type': fallbackIcon.contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch icon')
  }
}
