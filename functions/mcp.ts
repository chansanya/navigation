import {
  McpServer,
  createMcpHandler,
  type AuthInfo
} from '@modelcontextprotocol/server'
import { z } from 'zod'
import {
  PRIVATE_CATEGORY_NAME,
  createSite,
  findSiteByUrl,
  getCategories,
  getSites,
  getSiteById,
  normalizeUrlInput,
  normalizeUrlForCompare,
  updateSite
} from './db'
import { HttpError, normalizePublicHttpUrl, timingSafeEqualText } from './security'
import { extractSiteInfo } from './services/site-extractor'

interface Env {
  DB: D1Database
  MCP_API_TOKEN?: string
}

interface PreviewPayload {
  version: 1
  issuedAt: number
  expiresAt: number
  url: string
  name: string
  category: string
  description: string
  icon: string
  sort: 0
}

interface UpdatePreviewPayload {
  version: 1
  action: 'update'
  issuedAt: number
  expiresAt: number
  siteId: number
  changes: {
    name?: string
    url?: string
    category?: string
    description?: string
    icon?: string
  }
}

const serverInfo = {
  name: 'navigation',
  version: '1.0.0'
}

const previewTtlSeconds = 10 * 60
const previewSignatureContext = 'navigation:mcp-preview:v1:'
const maxMcpRequestBytes = 64 * 1024

const previewPayloadSchema = z.object({
  version: z.literal(1),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  url: z.string().min(1).max(2048),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  description: z.string().max(300),
  icon: z.string().max(2048),
  sort: z.literal(0)
}).strict()

const updatePreviewPayloadSchema = z.object({
  version: z.literal(1),
  action: z.literal('update'),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  siteId: z.number().int().positive(),
  changes: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    url: z.string().min(1).max(2048).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    description: z.string().max(300).optional(),
    icon: z.string().max(2048).optional()
  }).strict()
}).strict()

const updatePreviewSignatureContext = 'navigation:mcp-update-preview:v1:'

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

async function signPreviewPayload(encodedPayload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${previewSignatureContext}${encodedPayload}`)
  )
  const bytes = new Uint8Array(signature)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function createPreviewToken(payload: PreviewPayload, secret: string) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload))
  const signature = await signPreviewPayload(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

async function verifyPreviewToken(token: string, secret: string): Promise<PreviewPayload> {
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new HttpError(400, '预览凭证格式无效')
  }

  const [encodedPayload, signature] = parts
  const expectedSignature = await signPreviewPayload(encodedPayload, secret)
  if (!await timingSafeEqualText(signature, expectedSignature)) {
    throw new HttpError(401, '预览凭证签名无效')
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(decodeBase64Url(encodedPayload))
  } catch {
    throw new HttpError(400, '预览凭证内容无效')
  }

  const parsed = previewPayloadSchema.safeParse(decoded)
  if (!parsed.success) {
    throw new HttpError(400, '预览凭证内容无效')
  }

  if (parsed.data.expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new HttpError(410, '预览凭证已过期，请重新预览')
  }

  return parsed.data
}

async function signUpdatePreviewPayload(encodedPayload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${updatePreviewSignatureContext}${encodedPayload}`)
  )
  const bytes = new Uint8Array(signature)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function createUpdatePreviewToken(payload: UpdatePreviewPayload, secret: string) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload))
  const signature = await signUpdatePreviewPayload(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

async function verifyUpdatePreviewToken(token: string, secret: string): Promise<UpdatePreviewPayload> {
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new HttpError(400, '修改凭证格式无效')
  }

  const [encodedPayload, signature] = parts
  const expectedSignature = await signUpdatePreviewPayload(encodedPayload, secret)
  if (!await timingSafeEqualText(signature, expectedSignature)) {
    throw new HttpError(401, '修改凭证签名无效')
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(decodeBase64Url(encodedPayload))
  } catch {
    throw new HttpError(400, '修改凭证内容无效')
  }

  const parsed = updatePreviewPayloadSchema.safeParse(decoded)
  if (!parsed.success) {
    throw new HttpError(400, '修改凭证内容无效')
  }

  if (parsed.data.expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new HttpError(410, '修改凭证已过期，请重新预览')
  }

  return parsed.data
}

function resultContent(data: Record<string, unknown>) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(data, null, 2)
    }],
    structuredContent: data
  }
}

function errorContent(code: string, message: string, details: Record<string, unknown> = {}) {
  return {
    ...resultContent({
      success: false,
      code,
      message,
      ...details
    }),
    isError: true
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof HttpError ? error.message : fallback
}

function logToolError(tool: string, error: unknown) {
  console.error(JSON.stringify({
    event: 'mcp_tool_error',
    tool,
    errorType: error instanceof Error ? error.name : 'UnknownError'
  }))
}

async function getPublicCategories(db: D1Database) {
  const categories = await getCategories(db, false)
  return categories.filter((category) => category.name !== PRIVATE_CATEGORY_NAME)
}

async function requirePublicCategory(db: D1Database, input: string) {
  const category = input.trim()
  const categories = await getPublicCategories(db)
  const exists = categories.some((item) => item.name === category)

  if (!exists) {
    throw new HttpError(400, '分类不存在，请从现有公开分类中选择')
  }

  return {
    category,
    categories
  }
}

function normalizeOptionalIcon(value: string | undefined, fallback: string | undefined) {
  const selected = value === undefined ? (fallback || '') : value.trim()
  if (!selected) return ''
  return normalizePublicHttpUrl(selected).toString()
}

function existingSiteDetails(site: { id?: number; name: string; url: string; category?: string }) {
  if (site.category === PRIVATE_CATEGORY_NAME) return {}

  return {
    existingSite: {
      id: site.id,
      name: site.name,
      url: site.url
    }
  }
}

function createNavigationMcpServer(env: Env) {
  const server = new McpServer(serverInfo)

  server.registerTool('list_site_categories', {
    title: '列出站点分类',
    description: '列出导航站现有的公开分类。添加站点前应先调用此工具选择准确分类。',
    inputSchema: z.object({}),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  }, async () => {
    try {
      const categories = await getPublicCategories(env.DB)
      return resultContent({
        success: true,
        categories: categories.map(({ name, sort }) => ({ name, sort }))
      })
    } catch (error) {
      logToolError('list_site_categories', error)
      return errorContent('categories_unavailable', '读取站点分类失败')
    }
  })

  server.registerTool('preview_site', {
    title: '预览新增站点',
    description: '检查 URL、分类和重复记录，抓取站点名称、描述与图标，并生成 10 分钟有效的确认凭证。此工具不会写入数据库。',
    inputSchema: z.object({
      url: z.string().trim().min(1).max(2048).describe('要添加的 HTTP/HTTPS 站点地址'),
      category: z.string().trim().min(1).max(80).describe('必须是现有公开分类的准确名称'),
      name: z.string().trim().min(1).max(120).optional().describe('可选的站点名称覆盖值'),
      description: z.string().trim().max(300).optional().describe('可选的站点描述覆盖值'),
      icon: z.string().trim().max(2048).optional().describe('可选的公开 HTTP/HTTPS 图标地址')
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  }, async ({ url, category, name, description, icon }) => {
    try {
      const normalizedUrl = normalizePublicHttpUrl(normalizeUrlInput(url)).toString()
      const categoryState = await requirePublicCategory(env.DB, category)
      const existing = await findSiteByUrl(env.DB, normalizedUrl)

      if (existing) {
        return errorContent(
          'duplicate_site',
          '该站点已存在，不能重复添加',
          existingSiteDetails(existing)
        )
      }

      const extraction = await extractSiteInfo(normalizedUrl)
      const finalName = (name || extraction.info.title || new URL(extraction.url).hostname).trim().slice(0, 120)
      const finalDescription = description === undefined
        ? (extraction.info.description || '').trim().slice(0, 300)
        : description.trim().slice(0, 300)
      const finalIcon = normalizeOptionalIcon(icon, extraction.info.icon)
      const issuedAt = Math.floor(Date.now() / 1000)
      const payload: PreviewPayload = {
        version: 1,
        issuedAt,
        expiresAt: issuedAt + previewTtlSeconds,
        url: extraction.url,
        name: finalName,
        category: categoryState.category,
        description: finalDescription,
        icon: finalIcon,
        sort: 0
      }
      const previewToken = await createPreviewToken(payload, env.MCP_API_TOKEN || '')

      return resultContent({
        success: true,
        preview: {
          url: payload.url,
          name: payload.name,
          category: payload.category,
          description: payload.description,
          icon: payload.icon,
          sort: payload.sort
        },
        previewToken,
        expiresAt: new Date(payload.expiresAt * 1000).toISOString(),
        confirmationRequired: true
      })
    } catch (error) {
      logToolError('preview_site', error)
      const categories = await getPublicCategories(env.DB).catch(() => [])
      return errorContent('preview_failed', errorMessage(error, '站点预览失败'), {
        availableCategories: categories.map((item) => item.name)
      })
    }
  })

  server.registerTool('add_site', {
    title: '确认添加站点',
    description: '在用户确认预览内容后，使用 preview_site 返回的凭证写入站点。不能绕过预览直接提交完整字段。',
    inputSchema: z.object({
      previewToken: z.string().min(1).max(16384).describe('preview_site 返回的短期确认凭证')
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  }, async ({ previewToken }) => {
    try {
      const payload = await verifyPreviewToken(previewToken, env.MCP_API_TOKEN || '')
      const normalizedUrl = normalizePublicHttpUrl(normalizeUrlInput(payload.url)).toString()
      await requirePublicCategory(env.DB, payload.category)

      const existing = await findSiteByUrl(env.DB, normalizedUrl)
      if (existing) {
        return errorContent(
          'duplicate_site',
          '该站点已存在，未重复写入',
          existingSiteDetails(existing)
        )
      }

      const site = await createSite(env.DB, {
        name: payload.name,
        url: normalizedUrl,
        icon: payload.icon,
        category: payload.category,
        description: payload.description,
        sort: 0
      })

      return resultContent({
        success: true,
        site: {
          id: site.id,
          name: site.name,
          url: site.url,
          category: site.category
        }
      })
    } catch (error) {
      logToolError('add_site', error)
      return errorContent('add_failed', errorMessage(error, '添加站点失败'))
    }
  })

  server.registerTool('search_sites', {
    title: '搜索站点',
    description: '按关键词搜索导航站中已有的公开站点。返回匹配的站点列表（包含 id），用于后续修改或确认是否已存在。',
    inputSchema: z.object({
      keyword: z.string().trim().min(1).max(120).describe('搜索关键词，匹配站点名称、URL 或描述'),
      category: z.string().trim().max(80).optional().describe('可选：限定在某个分类内搜索')
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  }, async ({ keyword, category }) => {
    try {
      const allSites = await getSites(env.DB, category, false)
      const lowerKeyword = keyword.toLowerCase()
      const matched = allSites.filter((site) => {
        const name = (site.name || '').toLowerCase()
        const url = (site.url || '').toLowerCase()
        const description = (site.description || '').toLowerCase()
        return name.includes(lowerKeyword)
          || url.includes(lowerKeyword)
          || description.includes(lowerKeyword)
      })

      return resultContent({
        success: true,
        total: matched.length,
        sites: matched.slice(0, 20).map((site) => ({
          id: site.id,
          name: site.name,
          url: site.url,
          category: site.category,
          description: site.description || '',
          icon: site.icon || ''
        }))
      })
    } catch (error) {
      logToolError('search_sites', error)
      return errorContent('search_failed', '搜索站点失败')
    }
  })

  server.registerTool('preview_update_site', {
    title: '预览修改站点',
    description: '预览对已有站点的修改内容。需要提供站点 ID（通过 search_sites 获取）和要修改的字段。生成 10 分钟有效的确认凭证，不会直接写入数据库。',
    inputSchema: z.object({
      siteId: z.number().int().positive().describe('要修改的站点 ID，通过 search_sites 获取'),
      name: z.string().trim().min(1).max(120).optional().describe('新的站点名称'),
      url: z.string().trim().min(1).max(2048).optional().describe('新的站点 URL'),
      category: z.string().trim().min(1).max(80).optional().describe('新的分类，必须是现有公开分类的准确名称'),
      description: z.string().trim().max(300).optional().describe('新的站点描述'),
      icon: z.string().trim().max(2048).optional().describe('新的公开 HTTP/HTTPS 图标地址')
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  }, async ({ siteId, name, url, category, description, icon }) => {
    try {
      const existing = await getSiteById(env.DB, siteId)
      if (!existing) {
        return errorContent('site_not_found', '站点不存在')
      }

      // MCP 不允许操作隐私空间站点
      if (existing.category === PRIVATE_CATEGORY_NAME) {
        return errorContent('site_not_found', '站点不存在')
      }

      // 至少需要修改一个字段
      if (name === undefined && url === undefined && category === undefined && description === undefined && icon === undefined) {
        return errorContent('no_changes', '未指定任何要修改的字段')
      }

      const changes: UpdatePreviewPayload['changes'] = {}

      if (name !== undefined) {
        changes.name = name.trim().slice(0, 120)
      }

      if (url !== undefined) {
        const normalizedUrl = normalizePublicHttpUrl(normalizeUrlInput(url)).toString()

        // 检查 URL 是否与其他站点重复
        if (normalizeUrlForCompare(normalizedUrl) !== normalizeUrlForCompare(existing.url)) {
          const duplicate = await findSiteByUrl(env.DB, normalizedUrl, siteId)
          if (duplicate) {
            return errorContent(
              'duplicate_site',
              '该 URL 已被其他站点使用',
              existingSiteDetails(duplicate)
            )
          }
        }

        changes.url = normalizedUrl
      }

      if (category !== undefined) {
        await requirePublicCategory(env.DB, category)
        // 不允许将站点移入隐私空间
        if (category === PRIVATE_CATEGORY_NAME) {
          return errorContent('invalid_category', '不能通过 MCP 将站点移入隐私空间')
        }
        changes.category = category
      }

      if (description !== undefined) {
        changes.description = description.trim().slice(0, 300)
      }

      if (icon !== undefined) {
        changes.icon = normalizeOptionalIcon(icon, undefined)
      }

      const issuedAt = Math.floor(Date.now() / 1000)
      const payload: UpdatePreviewPayload = {
        version: 1,
        action: 'update',
        issuedAt,
        expiresAt: issuedAt + previewTtlSeconds,
        siteId,
        changes
      }

      const updateToken = await createUpdatePreviewToken(payload, env.MCP_API_TOKEN || '')

      return resultContent({
        success: true,
        currentSite: {
          id: existing.id,
          name: existing.name,
          url: existing.url,
          category: existing.category,
          description: existing.description || '',
          icon: existing.icon || ''
        },
        changes,
        updateToken,
        expiresAt: new Date(payload.expiresAt * 1000).toISOString(),
        confirmationRequired: true
      })
    } catch (error) {
      logToolError('preview_update_site', error)
      const categories = await getPublicCategories(env.DB).catch(() => [])
      return errorContent('preview_update_failed', errorMessage(error, '站点修改预览失败'), {
        availableCategories: categories.map((item) => item.name)
      })
    }
  })

  server.registerTool('update_site', {
    title: '确认修改站点',
    description: '在用户确认修改内容后，使用 preview_update_site 返回的凭证写入修改。不能绕过预览直接修改。',
    inputSchema: z.object({
      updateToken: z.string().min(1).max(16384).describe('preview_update_site 返回的短期确认凭证')
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  }, async ({ updateToken }) => {
    try {
      const payload = await verifyUpdatePreviewToken(updateToken, env.MCP_API_TOKEN || '')
      const existing = await getSiteById(env.DB, payload.siteId)

      if (!existing) {
        return errorContent('site_not_found', '站点不存在')
      }

      if (existing.category === PRIVATE_CATEGORY_NAME) {
        return errorContent('site_not_found', '站点不存在')
      }

      const updateData: Record<string, unknown> = {}

      if (payload.changes.name !== undefined) {
        updateData.name = payload.changes.name
      }

      if (payload.changes.url !== undefined) {
        const normalizedUrl = normalizePublicHttpUrl(normalizeUrlInput(payload.changes.url)).toString()

        // 再次检查 URL 重复，防止预览到确认之间有其他写入
        if (normalizeUrlForCompare(normalizedUrl) !== normalizeUrlForCompare(existing.url)) {
          const duplicate = await findSiteByUrl(env.DB, normalizedUrl, payload.siteId)
          if (duplicate) {
            return errorContent(
              'duplicate_site',
              '该 URL 已被其他站点使用',
              existingSiteDetails(duplicate)
            )
          }
        }

        updateData.url = normalizedUrl
      }

      if (payload.changes.category !== undefined) {
        await requirePublicCategory(env.DB, payload.changes.category)
        updateData.category = payload.changes.category
      }

      if (payload.changes.description !== undefined) {
        updateData.description = payload.changes.description
      }

      if (payload.changes.icon !== undefined) {
        updateData.icon = payload.changes.icon
      }

      const site = await updateSite(env.DB, payload.siteId, updateData)

      return resultContent({
        success: true,
        site: {
          id: site?.id,
          name: site?.name,
          url: site?.url,
          category: site?.category,
          description: site?.description || '',
          icon: site?.icon || ''
        }
      })
    } catch (error) {
      logToolError('update_site', error)
      return errorContent('update_failed', errorMessage(error, '修改站点失败'))
    }
  })

  return server
}

function unauthorizedResponse(message = 'Unauthorized') {
  return Response.json({
    success: false,
    error: message
  }, {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Bearer realm="navigation-mcp"'
    }
  })
}

async function authenticateRequest(request: Request, expectedToken: string): Promise<AuthInfo | Response> {
  if (!expectedToken) {
    return Response.json({
      success: false,
      error: 'MCP service is not configured'
    }, { status: 503 })
  }

  const authorization = request.headers.get('Authorization') || ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim() || ''

  if (!token || !await timingSafeEqualText(token, expectedToken)) {
    return unauthorizedResponse()
  }

  return {
    token,
    clientId: 'navigation-mcp-client',
    scopes: ['sites:read', 'sites:write']
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const requestId = context.request.headers.get('CF-Ray') || crypto.randomUUID()
  const startedAt = Date.now()
  let response: Response

  try {
    const auth = await authenticateRequest(context.request, context.env.MCP_API_TOKEN || '')
    if (auth instanceof Response) {
      response = auth
    } else {
      const handler = createMcpHandler(
        () => createNavigationMcpServer(context.env),
        {
          legacy: 'stateless',
          responseMode: 'json',
          maxRequestBodySize: maxMcpRequestBytes
        }
      )
      response = await handler.fetch(context.request, { authInfo: auth })
    }
  } catch (error) {
    console.error(JSON.stringify({
      event: 'mcp_request_error',
      requestId,
      errorType: error instanceof Error ? error.name : 'UnknownError'
    }))
    response = Response.json({
      success: false,
      error: 'MCP request failed'
    }, { status: 500 })
  }

  const headers = new Headers(response.headers)
  headers.set('X-Request-Id', requestId)

  console.log(JSON.stringify({
    event: 'mcp_request',
    requestId,
    method: context.request.method,
    path: new URL(context.request.url).pathname,
    status: response.status,
    durationMs: Date.now() - startedAt
  }))

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}
