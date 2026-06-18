// GET /api/auth/session - 查询管理员会话状态

export const onRequestGet: PagesFunction = async (context) => {
  return Response.json({
    authenticated: Boolean(context.data.isAuthenticated)
  })
}
