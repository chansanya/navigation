#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const DEFAULT_D1_DIR = '.wrangler/state/v3/d1'
const DEFAULT_OUTPUT = 'scripts/sql/local-data.sql'

// SQLite 会维护 sqlite_* 内部表，Miniflare/Cloudflare 也可能写入 _cf_* 元数据表。
// 这些表不是业务数据，导出到远程 D1 反而容易失败，所以默认跳过。
const EXCLUDED_TABLE_PREFIXES = ['sqlite_', '_cf_']

// 按外键关系排序。删除时先删子表，插入时先插父表。
// shortcuts.site_id 依赖 sites.id，因此 shortcuts 删除要早于 sites，插入要晚于 sites。
const DELETE_ORDER = ['shortcuts', 'site_submissions', 'sites', 'settings', 'categories']
const INSERT_ORDER = ['categories', 'settings', 'sites', 'site_submissions', 'shortcuts']

function printHelp() {
  console.log(`
用法:
  node scripts/export-local-sqlite.js [options]

参数:
  --db <path>           SQLite 数据库路径。默认读取 ${DEFAULT_D1_DIR} 下最新的 .sqlite 文件
  --out <path>          SQL 输出文件路径。默认输出到 ${DEFAULT_OUTPUT}
  --tables <a,b,c>      只导出指定表，多个表名用英文逗号分隔
  --stdout              输出 SQL 到终端，不写入文件
  --help                显示帮助信息

生成的 SQL:
  DELETE FROM "child_table";
  DELETE FROM "parent_table";
  INSERT INTO "parent_table" VALUES (...);
  INSERT INTO "table" VALUES (...);

用途:
  生成 Wrangler D1 远程执行兼容的本地数据快照。
  不包含 BEGIN/COMMIT/SAVEPOINT/ROLLBACK 等事务语句。
  同步到远程 D1 可直接使用 npm run sync:remote-db。
`)
}

function parseArgs(argv) {
  // 保持脚本零依赖，参数量也不大，用手写解析更直观。
  const options = {
    db: '',
    out: DEFAULT_OUTPUT,
    stdout: false,
    tables: []
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    if (arg === '--db') {
      options.db = argv[++index] || ''
      continue
    }

    if (arg === '--out') {
      options.out = argv[++index] || ''
      continue
    }

    if (arg === '--stdout') {
      options.stdout = true
      continue
    }

    if (arg === '--tables') {
      options.tables = (argv[++index] || '')
        .split(',')
        .map((table) => table.trim())
        .filter(Boolean)
      continue
    }

    throw new Error(`未知参数: ${arg}`)
  }

  return options
}

function findSqliteFiles(dir) {
  if (!existsSync(dir)) return []

  // Wrangler/Miniflare 的本地 D1 路径里会有随机子目录，
  // 递归找 .sqlite 比写死某个文件名可靠。
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...findSqliteFiles(fullPath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.sqlite')) {
      files.push(fullPath)
    }
  }

  return files
}

function findNewestLocalD1Database() {
  const files = findSqliteFiles(DEFAULT_D1_DIR)
  if (files.length === 0) {
    throw new Error(`未在 ${DEFAULT_D1_DIR} 下找到本地 SQLite 数据库。请先运行 npm run pages:dev，或通过 --db 指定数据库路径。`)
  }

  // 本地可能残留多个 Miniflare 数据库文件，默认取最近修改的那个，
  // 更符合“刚刚在本地调试后导出”的使用场景。
  return files
    .map((file) => ({
      file,
      mtime: statSync(file).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime)[0].file
}

function runSqlite(dbPath, args) {
  // 只读方式打开 SQLite，避免导出脚本意外改动本地 D1。
  return execFileSync('sqlite3', ['-readonly', dbPath, ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 100
  })
}

function quoteIdentifier(identifier) {
  // 表名来自 sqlite_master，仍然做标识符转义，避免特殊字符破坏 SQL。
  return `"${identifier.replaceAll('"', '""')}"`
}

function orderIndex(table, order, fallbackIndex) {
  const index = order.indexOf(table)
  return index >= 0 ? index : order.length + fallbackIndex
}

function sortTables(tables, order) {
  return [...tables].sort((a, b) => (
    orderIndex(a, order, tables.indexOf(a)) - orderIndex(b, order, tables.indexOf(b))
  ))
}

function getTables(dbPath, selectedTables) {
  // 从 sqlite_master 读取实际存在的表，再按需过滤用户指定表。
  const sql = [
    'SELECT name',
    'FROM sqlite_master',
    "WHERE type = 'table'",
    ...EXCLUDED_TABLE_PREFIXES.map((prefix) => `AND name NOT LIKE '${prefix}%'`),
    'ORDER BY name;'
  ].join(' ')

  const tables = runSqlite(dbPath, ['-noheader', '-batch', sql])
    .split('\n')
    .map((table) => table.trim())
    .filter(Boolean)

  if (selectedTables.length === 0) return tables

  const existing = new Set(tables)
  const missing = selectedTables.filter((table) => !existing.has(table))
  if (missing.length > 0) {
    throw new Error(`未找到表: ${missing.join(', ')}`)
  }

  return tables.filter((table) => selectedTables.includes(table))
}

function dumpTable(dbPath, table) {
  const quotedTable = quoteIdentifier(table)
  const sql = `SELECT * FROM ${quotedTable};`

  // sqlite3 的 .mode insert 会把查询结果转成 INSERT 语句，
  // 比自己拼 SQL 更稳，尤其是文本转义、NULL、blob/data URL 等值。
  const insertSql = runSqlite(dbPath, [
    '-batch',
    '-cmd',
    `.mode insert ${quotedTable}`,
    sql
  ]).trim()

  return {
    table,
    deleteSql: `DELETE FROM ${quotedTable};`,
    insertSql
  }
}

function buildExportSql(dbPath, tables) {
  // 直接生成 Wrangler D1 远程兼容 SQL：
  // - 不写 BEGIN/COMMIT，避免 D1 拒绝显式事务语句。
  // - DELETE 和 INSERT 分开输出，并按外键关系排序。
  const sections = [
    '-- Generated by scripts/export-local-sqlite.js',
    `-- Source: ${dbPath}`,
    `-- Generated at: ${new Date().toISOString()}`,
    '-- Compatible with: wrangler d1 execute --remote --file',
    '',
    '-- Delete existing data',
    ''
  ]
  const dumps = tables.map((table) => dumpTable(dbPath, table))
  const dumpByTable = new Map(dumps.map((dump) => [dump.table, dump]))

  for (const table of sortTables(tables, DELETE_ORDER)) {
    const dump = dumpByTable.get(table)
    if (!dump) continue
    sections.push(`-- Table: ${table}`)
    sections.push(dump.deleteSql)
    sections.push('')
  }

  sections.push('-- Insert exported data')
  sections.push('')

  for (const table of sortTables(tables, INSERT_ORDER)) {
    const dump = dumpByTable.get(table)
    if (!dump?.insertSql) continue
    sections.push(`-- Table: ${table}`)
    sections.push(dump.insertSql)
    sections.push('')
  }

  return sections.join('\n')
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const dbPath = resolve(options.db || findNewestLocalD1Database())

  if (!existsSync(dbPath)) {
    throw new Error(`SQLite 数据库不存在: ${dbPath}`)
  }

  const tables = getTables(dbPath, options.tables)
  const sql = buildExportSql(dbPath, tables)

  if (options.stdout) {
    // 给排查或自定义管道留一个出口，不强制写文件。
    process.stdout.write(sql)
    return
  }

  const outputPath = resolve(options.out || DEFAULT_OUTPUT)
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, sql)

  console.log(`已从 ${dbPath} 导出 ${tables.length} 张表`)
  console.log(`输出文件: ${outputPath}`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
