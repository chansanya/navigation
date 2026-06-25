// 全局中间件：CORS + 认证预处理

import { ADMIN_SESSION_COOKIE, PRIVACY_SESSION_COOKIE, verifySignedSessionCookie } from './session'

interface Env {
  DB: D1Database
  ADMIN_TOKEN: string
  PRIVATE_PASSWORD?: string
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  // 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // 为 context.data 注入数据库和认证信息
  context.data.db = env.DB
  context.data.adminToken = env.ADMIN_TOKEN || ''
  context.data.privatePassword = env.PRIVATE_PASSWORD || ''

  // 所有 API 统一在中间件验签，具体接口只读取布尔状态决定权限。
  context.data.isAuthenticated = await verifySignedSessionCookie(request, env.ADMIN_TOKEN || '', ADMIN_SESSION_COOKIE)

  context.data.isPrivacyUnlocked = await verifySignedSessionCookie(request, env.PRIVATE_PASSWORD || '', PRIVACY_SESSION_COOKIE)

  // 继续处理请求
  const response = await context.next()

  // 添加 CORS 头
  // Pages Functions 返回的 Response headers 不可直接改，复制一份再重建响应。
  const newHeaders = new Headers(response.headers)
  newHeaders.set('Access-Control-Allow-Origin', '*')
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}
