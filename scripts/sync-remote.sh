#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_SQL_FILE="${SCRIPT_DIR}/sql/local-data.sql"
DB_NAME="${D1_DATABASE_NAME:-navigation_db}"
SQL_FILE="${DEFAULT_SQL_FILE}"
SKIP_CONFIRM=0

print_help() {
  cat <<'EOF'
用法:
  bash scripts/sync-remote.sh [options]

参数:
  --db <name>       D1 数据库名称，默认 navigation_db，也可通过 D1_DATABASE_NAME 设置
  --file <path>     要同步的 SQL 文件，默认 scripts/sql/local-data.sql
  --yes             跳过确认，直接执行远程同步
  --help            显示帮助信息

说明:
  该脚本直接执行导出的 SQL:
    npx wrangler d1 execute <db> --remote --file=<sql-file>

  local-data.sql 由 npm run export:local-db 生成，通常包含 DELETE 和 INSERT。
  导出脚本已经生成 Wrangler/D1 远程兼容 SQL，不需要再生成临时转换文件。
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db)
      DB_NAME="${2:-}"
      shift 2
      ;;
    --file)
      SQL_FILE="${2:-}"
      shift 2
      ;;
    --yes|-y)
      SKIP_CONFIRM=1
      shift
      ;;
    --help|-h)
      print_help
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      print_help
      exit 1
      ;;
  esac
done

if [[ -z "${DB_NAME}" ]]; then
  echo "D1 数据库名称不能为空" >&2
  exit 1
fi

if [[ "${SQL_FILE}" != /* ]]; then
  SQL_FILE="${REPO_ROOT}/${SQL_FILE}"
fi

if [[ ! -f "${SQL_FILE}" ]]; then
  echo "SQL 文件不存在: ${SQL_FILE}" >&2
  echo "请先运行: npm run export:local-db" >&2
  exit 1
fi

if grep -Eiq '^[[:space:]]*(BEGIN([[:space:]]+TRANSACTION)?|COMMIT|SAVEPOINT|ROLLBACK|PRAGMA)([[:space:];=]|$)' "${SQL_FILE}"; then
  echo "SQL 文件包含 D1 远程不支持的事务或外键开关语句: ${SQL_FILE}" >&2
  echo "请重新运行: npm run export:local-db" >&2
  exit 1
fi

echo "远程 D1 数据库: ${DB_NAME}"
echo "SQL 文件: ${SQL_FILE}"
echo
echo "注意: 该 SQL 可能会先删除远程表数据，再写入本地导出的数据。"

if [[ "${SKIP_CONFIRM}" -ne 1 ]]; then
  read -r -p "确认同步到远程 D1？输入 yes 继续: " CONFIRM
  if [[ "${CONFIRM}" != "yes" ]]; then
    echo "已取消"
    exit 0
  fi
fi

cd "${REPO_ROOT}"
npx wrangler d1 execute "${DB_NAME}" --remote --file="${SQL_FILE}"
