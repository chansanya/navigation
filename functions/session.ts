const SESSION_VERSION = 'v1'

export const ADMIN_SESSION_COOKIE = 'nav_admin_session'
export const PRIVACY_SESSION_COOKIE = 'nav_privacy_session'
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 15

function base64UrlEncode(buffer: ArrayBuffer) {
  // Cookie 中不能直接放普通 base64 的 + / =，转成 URL-safe 格式更稳。
  const bytes = new Uint8Array(buffer)
  let binary = ''

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function signPayload(secret: string, payload: string) {
  // 用服务端环境变量作为 HMAC 密钥，前端只能持有签名结果，不能伪造会话。
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  return base64UrlEncode(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)))
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false

  // 固定遍历完整字符串，减少普通字符串比较带来的计时侧信道。
  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }

  return diff === 0
}

function getCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return ''

  const cookies = cookieHeader.split(';')
  for (const cookie of cookies) {
    // Cookie value 里可能包含 =，所以只把第一个 = 之前当作 key。
    const [rawKey, ...rawValue] = cookie.trim().split('=')
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join('=') || '')
    }
  }

  return ''
}

function shouldUseSecureCookie(request: Request) {
  return new URL(request.url).protocol === 'https:'
}

function buildCookie(name: string, value: string, request: Request, maxAgeSeconds?: number) {
  // 所有认证态都写入 HttpOnly Cookie，避免令牌进入 localStorage 被脚本读取。
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax'
  ]

  if (typeof maxAgeSeconds === 'number') {
    parts.push(`Max-Age=${maxAgeSeconds}`)
  }

  if (shouldUseSecureCookie(request)) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

export function clearSessionCookie(name: string, request: Request) {
  return buildCookie(name, '', request, 0)
}

export async function createSignedSessionCookie(
  name: string,
  secret: string,
  request: Request,
  maxAgeSeconds?: number
) {
  // Cookie 值格式：版本.过期时间.签名；验证时只需重算签名，不需要服务端会话表。
  const expiresAt = typeof maxAgeSeconds === 'number'
    ? Date.now() + maxAgeSeconds * 1000
    : 0
  const payload = `${SESSION_VERSION}.${expiresAt}`
  const signature = await signPayload(secret, payload)

  return buildCookie(name, `${payload}.${signature}`, request, maxAgeSeconds)
}

export async function verifySignedSessionCookie(request: Request, secret: string, name: string) {
  if (!secret) return false

  const value = getCookie(request.headers.get('Cookie'), name)
  if (!value) return false

  const [version, rawExpiresAt, signature] = value.split('.')
  if (version !== SESSION_VERSION || !rawExpiresAt || !signature) return false

  // 过期时间是签名 payload 的一部分，用户无法单独延长有效期。
  const expiresAt = Number(rawExpiresAt)
  if (!Number.isFinite(expiresAt)) return false
  if (expiresAt > 0 && Date.now() > expiresAt) return false

  const payload = `${version}.${rawExpiresAt}`
  const expectedSignature = await signPayload(secret, payload)

  return timingSafeEqual(signature, expectedSignature)
}
