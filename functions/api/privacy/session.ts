// GET /api/privacy/session - 查询隐私模式会话状态

export const onRequestGet: PagesFunction = async (context) => {
  // 中间件统一判断隐私 Cookie 是否有效，接口只暴露解锁状态。
  return Response.json({
    unlocked: Boolean(context.data.isPrivacyUnlocked)
  })
}
