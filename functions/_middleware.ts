// 全局中间件：CORS + 认证预处理

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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Privacy-Token',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // 为 context.data 注入数据库和认证信息
  context.data.db = env.DB
  context.data.adminToken = env.ADMIN_TOKEN || ''
  context.data.privatePassword = env.PRIVATE_PASSWORD || ''

  // 检查是否携带有效的 token
  const authHeader = request.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    context.data.isAuthenticated = token === context.data.adminToken
  } else {
    context.data.isAuthenticated = false
  }

  const privacyHeader = request.headers.get('X-Privacy-Token') || ''
  context.data.isPrivacyUnlocked = Boolean(context.data.privatePassword) && privacyHeader === context.data.privatePassword

  // 继续处理请求
  const response = await context.next()

  // 添加 CORS 头
  const newHeaders = new Headers(response.headers)
  newHeaders.set('Access-Control-Allow-Origin', '*')
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Privacy-Token')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}
