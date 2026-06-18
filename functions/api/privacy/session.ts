// GET /api/privacy/session - 查询隐私模式会话状态

export const onRequestGet: PagesFunction = async (context) => {
  return Response.json({
    unlocked: Boolean(context.data.isPrivacyUnlocked)
  })
}
