export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface FetchOptions {
  timeoutMs: number
  maxRedirects?: number
}

const redirectStatuses = new Set([301, 302, 303, 307, 308])

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Bytes(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
}

function parseIPv4(hostname: string) {
  const parts = hostname.split('.')
  if (parts.length !== 4) return null

  const numbers = parts.map((part) => {
    if (!/^\d+$/.test(part)) return Number.NaN
    return Number(part)
  })

  if (numbers.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null
  return numbers
}

function isBlockedIPv4(hostname: string) {
  const ip = parseIPv4(hostname)
  if (!ip) return false
  const [a, b, c] = ip

  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 192 && b === 0 && c === 0)
    || (a === 192 && b === 0 && c === 2)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224
}

function isBlockedIPv6(hostname: string) {
  const normalized = hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase()
  if (!normalized.includes(':')) return false

  const mappedIPv4 = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  if (mappedIPv4 && isBlockedIPv4(mappedIPv4)) return true

  const firstGroup = normalized.split(':')[0]
  return normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('::1')
    || firstGroup === 'fc'
    || firstGroup === 'fd'
    || firstGroup.startsWith('fc')
    || firstGroup.startsWith('fd')
    || ['fe8', 'fe9', 'fea', 'feb'].some((prefix) => firstGroup.startsWith(prefix))
    || normalized.startsWith('2001:db8')
}

function isBlockedHostname(hostname: string) {
  const normalized = hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase()
  return normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
    || isBlockedIPv4(normalized)
    || isBlockedIPv6(normalized)
}

export function normalizePublicHttpUrl(value: unknown) {
  if (typeof value !== 'string') {
    throw new HttpError(400, '无效 URL')
  }

  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new HttpError(400, '无效 URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, '仅支持 HTTP/HTTPS URL')
  }

  if (url.username || url.password) {
    throw new HttpError(400, 'URL 不能包含用户名或密码')
  }

  if (isBlockedHostname(url.hostname)) {
    throw new HttpError(400, '不允许访问该 URL')
  }

  return url
}

export function resolvePublicHttpUrl(value: string, baseUrl?: URL) {
  const resolved = baseUrl ? new URL(value, baseUrl) : new URL(value)
  return normalizePublicHttpUrl(resolved.toString())
}

async function readLimitedBytesFromBody(body: ReadableStream<Uint8Array> | null, maxBytes: number) {
  if (!body) return new Uint8Array()

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        throw new HttpError(413, '响应内容过大')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }

  return result
}

function assertContentLengthWithinLimit(value: string | null, maxBytes: number) {
  if (!value) return
  const contentLength = Number(value)
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new HttpError(413, '响应内容过大')
  }
}

export async function readLimitedRequestJson(request: Request, maxBytes: number) {
  assertContentLengthWithinLimit(request.headers.get('Content-Length'), maxBytes)
  const bytes = await readLimitedBytesFromBody(request.body, maxBytes)
  if (bytes.byteLength === 0) {
    throw new HttpError(400, '请求体不能为空')
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
  } catch {
    throw new HttpError(400, '请求体不是有效 JSON')
  }
}

export async function readLimitedResponseBytes(response: Response, maxBytes: number) {
  assertContentLengthWithinLimit(response.headers.get('Content-Length'), maxBytes)
  return readLimitedBytesFromBody(response.body, maxBytes)
}

export async function readLimitedResponseText(response: Response, maxBytes: number) {
  const bytes = await readLimitedResponseBytes(response, maxBytes)
  return new TextDecoder().decode(bytes)
}

export async function fetchWithValidatedRedirects(url: URL, init: RequestInit, options: FetchOptions) {
  const maxRedirects = options.maxRedirects ?? 3
  let currentUrl = normalizePublicHttpUrl(url.toString())

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetch(currentUrl.toString(), {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs)
    })

    if (!redirectStatuses.has(response.status)) {
      return {
        response,
        url: currentUrl
      }
    }

    const location = response.headers.get('Location')
    if (!location) {
      throw new HttpError(400, '跳转地址无效')
    }

    currentUrl = resolvePublicHttpUrl(location, currentUrl)
  }

  throw new HttpError(400, '跳转次数过多')
}

export function createErrorResponse(error: unknown, fallbackMessage = '请求失败') {
  if (error instanceof HttpError) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: error.status })
  }

  return Response.json({
    success: false,
    error: fallbackMessage
  }, { status: 500 })
}

export function createRateLimitResponse(retryAfterSeconds: number) {
  return Response.json({
    success: false,
    error: '请求过于频繁，请稍后再试',
    retryAfter: retryAfterSeconds
  }, {
    status: 429,
    headers: {
      'Retry-After': String(Math.max(1, retryAfterSeconds))
    }
  })
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]
    || 'unknown'
  return forwardedFor.trim() || 'unknown'
}

export async function createRateLimitKey(scope: string, request: Request) {
  const digest = await sha256Bytes(getClientIp(request))
  return `${scope}:${bytesToHex(digest)}`
}

export async function timingSafeEqualText(input: string, expected: string) {
  if (!expected) return false

  const [inputHash, expectedHash] = await Promise.all([
    sha256Bytes(input),
    sha256Bytes(expected)
  ])

  let diff = inputHash.length ^ expectedHash.length
  for (let index = 0; index < Math.max(inputHash.length, expectedHash.length); index += 1) {
    diff |= (inputHash[index] || 0) ^ (expectedHash[index] || 0)
  }

  return diff === 0
}
