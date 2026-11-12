// GET /api/mcp/config - 获取 MCP 接入配置（需管理员认证）

interface Env {
  MCP_API_TOKEN?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!context.data.isAuthenticated) {
    return Response.json({
      success: false,
      error: 'Unauthorized'
    }, {
      status: 401,
      headers: {
        'Cache-Control': 'no-store'
      }
    })
  }

  const token = (context.env.MCP_API_TOKEN || '').trim()

  return Response.json({
    success: true,
    configured: Boolean(token),
    token
  }, {
    headers: {
      'Cache-Control': 'no-store'
    }
  })
}
