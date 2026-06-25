// GET /api/vault - 获取加密密码本条目
// POST /api/vault - 创建加密密码本条目

import { createVaultEntry, getVaultEntries } from '../../db'

interface Env {
  DB: D1Database
}

function requireVaultAccess(context: EventContext<Env, string, Record<string, unknown>>) {
  // 密码本比普通管理功能更敏感，必须同时满足管理认证和隐私模式解锁。
  if (!context.data.isAuthenticated) {
    return Response.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  if (!context.data.isPrivacyUnlocked) {
    return Response.json({
      success: false,
      error: 'Privacy mode required'
    }, { status: 403 })
  }

  return null
}

function normalizeEncryptedField(value: unknown, maxLength: number) {
  // 服务端只接收加密材料；限制长度可以挡住明显异常的请求体。
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const accessError = requireVaultAccess(context)
  if (accessError) return accessError

  try {
    // 返回的是密文列表，解密只在浏览器端完成。
    const entries = await getVaultEntries(context.env.DB)

    return Response.json({
      success: true,
      entries
    })
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Failed to fetch vault entries'
    }, { status: 500 })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const accessError = requireVaultAccess(context)
  if (accessError) return accessError

  try {
    const data = await context.request.json() as Record<string, unknown>
    const salt = normalizeEncryptedField(data.salt, 200)
    const iv = normalizeEncryptedField(data.iv, 200)
    const ciphertext = normalizeEncryptedField(data.ciphertext, 20000)

    // 三个字段缺一不可：salt 用于派生密钥，iv 用于 AES-GCM，ciphertext 是密文本体。
    if (!salt || !iv || !ciphertext) {
      return Response.json({
        success: false,
        error: 'Missing encrypted payload'
      }, { status: 400 })
    }

    const entry = await createVaultEntry(context.env.DB, {
      salt,
      iv,
      ciphertext
    })

    return Response.json({
      success: true,
      entry
    })
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Failed to create vault entry'
    }, { status: 500 })
  }
}
