// POST /api/auth/verify - 验证管理员 token

interface Env {
  ADMIN_TOKEN: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { token } = await context.request.json() as { token: string }
    const validToken = context.env.ADMIN_TOKEN || ''

    return Response.json({
      valid: token === validToken && token.length > 0
    })
  } catch (error) {
    return Response.json({
      valid: false,
      error: 'Invalid request'
    }, { status: 400 })
  }
}
