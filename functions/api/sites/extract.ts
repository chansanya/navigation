// POST /api/sites/extract - 从 URL 自动提取站点信息

import { consumeRateLimit, normalizeUrlInput } from '../../db'
import {
  HttpError,
  createErrorResponse,
  createRateLimitResponse,
  createRateLimitKey,
  fetchWithValidatedRedirects,
  normalizePublicHttpUrl,
  readLimitedRequestJson,
  readLimitedResponseText,
  resolvePublicHttpUrl
} from '../../security'

interface Env {
  DB: D1Database
}

interface ExtractedInfo {
  title?: string
  description?: string
  icon?: string
}

const requestMaxBytes = 2048
const htmlMaxBytes = 256 * 1024
const fetchTimeoutMs = 5000
const iconTimeoutMs = 3000
const publicRateLimit = {
  limit: 30,
  windowMs: 10 * 60 * 1000,
  blockMs: 10 * 60 * 1000
}

function truncateText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

function isHtmlResponse(response: Response) {
  const contentType = response.headers.get('Content-Type')
  return !contentType
    || contentType.toLowerCase().includes('text/html')
    || contentType.toLowerCase().includes('application/xhtml+xml')
}

function isImageResponse(response: Response) {
  const contentType = response.headers.get('Content-Type')
  return !contentType || contentType.toLowerCase().startsWith('image/')
}

async function validateIcon(iconUrl: URL): Promise<boolean> {
  try {
    const { response } = await fetchWithValidatedRedirects(iconUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    }, {
      timeoutMs: iconTimeoutMs,
      maxRedirects: 2
    })

    return (response.ok || response.status === 304) && isImageResponse(response)
  } catch {
    return false
  }
}

function getIconCandidates(html: string, pageUrl: URL) {
  const candidates: URL[] = []
  const iconMatch = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["']/i)

  if (iconMatch) {
    try {
      candidates.push(resolvePublicHttpUrl(iconMatch[1], pageUrl))
    } catch {
      // 页面声明的图标地址不可信，忽略后继续尝试默认 favicon。
    }
  }

  candidates.push(resolvePublicHttpUrl('/favicon.ico', pageUrl))
  candidates.push(normalizePublicHttpUrl(`https://www.google.com/s2/favicons?domain=${pageUrl.hostname}&sz=128`))

  return candidates
}

async function getFirstValidIcon(html: string, pageUrl: URL) {
  for (const candidate of getIconCandidates(html, pageUrl)) {
    if (await validateIcon(candidate)) {
      return candidate.toString()
    }
  }

  return `https://www.google.com/s2/favicons?domain=${pageUrl.hostname}&sz=128`
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
    const targetUrl = normalizePublicHttpUrl(normalizeUrlInput(body.url))
    const info: ExtractedInfo = {}

    try {
      const { response, url: finalUrl } = await fetchWithValidatedRedirects(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml'
        }
      }, {
        timeoutMs: fetchTimeoutMs,
        maxRedirects: 3
      })

      if (!response.ok) {
        throw new HttpError(400, `HTTP ${response.status}`)
      }

      if (!isHtmlResponse(response)) {
        throw new HttpError(415, '目标不是 HTML 页面')
      }

      const html = await readLimitedResponseText(response, htmlMaxBytes)
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)

      if (titleMatch) {
        info.title = truncateText(titleMatch[1], 120)
      }

      if (descMatch) {
        info.description = truncateText(descMatch[1], 300)
      }

      info.icon = await getFirstValidIcon(html, finalUrl)
    } catch (error) {
      if (error instanceof HttpError && (error.status === 413 || error.status === 415)) {
        throw error
      }

      info.title = targetUrl.hostname
      info.icon = `https://www.google.com/s2/favicons?domain=${targetUrl.hostname}&sz=128`
    }

    return Response.json({
      success: true,
      info
    })
  } catch (error) {
    return createErrorResponse(error, 'Failed to extract site info')
  }
}
