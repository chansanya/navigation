const SESSION_VERSION = 'v1'

export const ADMIN_SESSION_COOKIE = 'nav_admin_session'
export const PRIVACY_SESSION_COOKIE = 'nav_privacy_session'
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 15

function base64UrlEncode(buffer: ArrayBuffer) {
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

  const expiresAt = Number(rawExpiresAt)
  if (!Number.isFinite(expiresAt)) return false
  if (expiresAt > 0 && Date.now() > expiresAt) return false

  const payload = `${version}.${rawExpiresAt}`
  const expectedSignature = await signPayload(secret, payload)

  return timingSafeEqual(signature, expectedSignature)
}
