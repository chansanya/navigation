// POST /api/privacy/verify - 验证隐私空间密码

interface Env {
  PRIVATE_PASSWORD?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const data = await context.request.json() as { password?: string }
    const privatePassword = context.env.PRIVATE_PASSWORD || ''
    const valid = Boolean(privatePassword) && data.password === privatePassword

    return Response.json({ valid })
  } catch {
    return Response.json({ valid: false })
  }
}
