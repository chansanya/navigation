// PUT /api/vault/:id - 更新加密随身记录条目
// DELETE /api/vault/:id - 删除加密随身记录条目

import { deleteVaultEntry, getVaultEntryById, updateVaultEntry } from '../../db'

interface Env {
  DB: D1Database
}

function requireVaultAccess(context: EventContext<Env, string, Record<string, unknown>>) {
  // 修改和删除随身记录同样要求双重门槛：管理认证 + 隐私模式。
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

function parseEntryId(value: string | string[] | undefined) {
  // Pages Functions 的动态参数可能是数组；统一收敛成正整数 ID。
  const rawId = Array.isArray(value) ? value[0] : value
  const id = Number(rawId)
  return Number.isInteger(id) && id > 0 ? id : 0
}

function normalizeEncryptedField(value: unknown, maxLength: number) {
  // API 不校验明文字段，因为服务端永远不应看到随身记录明文内容。
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const accessError = requireVaultAccess(context)
  if (accessError) return accessError

  try {
    const id = parseEntryId(context.params.id)
    if (!id) {
      return Response.json({
        success: false,
        error: 'Invalid vault entry ID'
      }, { status: 400 })
    }

    const existing = await getVaultEntryById(context.env.DB, id)
    if (!existing) {
      return Response.json({
        success: false,
        error: 'Vault entry not found'
      }, { status: 404 })
    }

    const data = await context.request.json() as Record<string, unknown>
    const salt = normalizeEncryptedField(data.salt, 200)
    const iv = normalizeEncryptedField(data.iv, 200)
    const ciphertext = normalizeEncryptedField(data.ciphertext, 20000)

    // 更新采用整条密文替换，避免服务端理解或拼接加密后的 JSON 内容。
    if (!salt || !iv || !ciphertext) {
      return Response.json({
        success: false,
        error: 'Missing encrypted payload'
      }, { status: 400 })
    }

    const entry = await updateVaultEntry(context.env.DB, id, {
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
      error: error.message || 'Failed to update vault entry'
    }, { status: 500 })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const accessError = requireVaultAccess(context)
  if (accessError) return accessError

  try {
    const id = parseEntryId(context.params.id)
    if (!id) {
      return Response.json({
        success: false,
        error: 'Invalid vault entry ID'
      }, { status: 400 })
    }

    const existing = await getVaultEntryById(context.env.DB, id)
    if (!existing) {
      return Response.json({
        success: false,
        error: 'Vault entry not found'
      }, { status: 404 })
    }

    await deleteVaultEntry(context.env.DB, id)

    return Response.json({
      success: true
    })
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Failed to delete vault entry'
    }, { status: 500 })
  }
}
