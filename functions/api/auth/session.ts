// GET /api/auth/session - 查询管理员会话状态

export const onRequestGet: PagesFunction = async (context) => {
  // 中间件已经完成 Cookie 验签，这里只返回前端需要的布尔状态。
  return Response.json({
    authenticated: Boolean(context.data.isAuthenticated)
  })
}
