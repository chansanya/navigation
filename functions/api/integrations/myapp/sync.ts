// POST /api/integrations/myapp/sync - 从 MyApp 导出接口同步随身记录

import { syncMyAppExport, type MyAppSyncedRecord } from '../../../integrations/myapp'
import { readLimitedRequestJson } from '../../../security'

interface Env {
  MYAPP_BASE_URL?: string
  MYAPP_EXPORT_KEY?: string
  MYAPP_PAYLOAD_KEY_PREFIX?: string
}

type SyncTypeFilter = 'all' | MyAppSyncedRecord['type']

interface SyncPreviewOptions {
  type: SyncTypeFilter
  accountCategory: string
  page: number
  pageSize: number
  paginate: boolean
}

function normalizeSyncType(value: unknown): SyncTypeFilter {
  return value === 'account' || value === 'note' ? value : 'all'
}

function normalizePositiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(1, Math.trunc(parsed)))
}

async function readSyncPreviewOptions(request: Request): Promise<SyncPreviewOptions> {
  if (!request.body) {
    return {
      type: 'all',
      accountCategory: 'all',
      page: 1,
      pageSize: 0,
      paginate: false
    }
  }

  const body = await readLimitedRequestJson(request, 2048)
  return {
    type: normalizeSyncType(body.type),
    accountCategory: typeof body.accountCategory === 'string' && body.accountCategory.trim()
      ? body.accountCategory.trim()
      : 'all',
    page: normalizePositiveInteger(body.page, 1, 100000),
    pageSize: normalizePositiveInteger(body.pageSize, 10, 50),
    paginate: true
  }
}

function countByType(records: MyAppSyncedRecord[]) {
  return {
    all: records.length,
    account: records.filter((record) => record.type === 'account').length,
    note: records.filter((record) => record.type === 'note').length
  }
}

function countAccountCategories(records: MyAppSyncedRecord[]) {
  const counts = new Map<string, number>()
  records.forEach((record) => {
    if (record.type !== 'account' || record.accountKind !== 'normal') return
    const category = record.category || '其他'
    counts.set(category, (counts.get(category) || 0) + 1)
  })

  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right, 'zh-CN'))
    .map(([category, count]) => ({ category, count }))
}

function filterPreviewRecords(records: MyAppSyncedRecord[], options: SyncPreviewOptions) {
  let filteredRecords = options.type === 'all'
    ? records
    : records.filter((record) => record.type === options.type)

  if (options.type === 'account' && options.accountCategory !== 'all') {
    filteredRecords = filteredRecords.filter((record) => (
      record.type === 'account'
      && record.accountKind === 'normal'
      && (record.category || '其他') === options.accountCategory
    ))
  }

  return filteredRecords
}

function paginateRecords(records: MyAppSyncedRecord[], options: SyncPreviewOptions) {
  if (!options.paginate) {
    return {
      records,
      pagination: {
        page: 1,
        pageSize: records.length,
        total: records.length,
        totalPages: 1
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(records.length / options.pageSize))
  const page = Math.min(options.page, totalPages)
  const start = (page - 1) * options.pageSize

  return {
    records: records.slice(start, start + options.pageSize),
    pagination: {
      page,
      pageSize: options.pageSize,
      total: records.length,
      totalPages
    }
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
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

  try {
    const options = await readSyncPreviewOptions(context.request)
    const result = await syncMyAppExport(
      context.env.MYAPP_BASE_URL,
      context.env.MYAPP_EXPORT_KEY,
      context.env.MYAPP_PAYLOAD_KEY_PREFIX
    )
    const filteredRecords = filterPreviewRecords(result.records, options)
    const preview = paginateRecords(filteredRecords, options)

    return Response.json({
      success: true,
      ...result,
      records: preview.records,
      counts: {
        ...result.counts,
        types: countByType(result.records),
        accountCategories: countAccountCategories(result.records)
      },
      pagination: preview.pagination
    })
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'MyApp 同步失败'
    }, { status: 400 })
  }
}
