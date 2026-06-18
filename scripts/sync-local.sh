#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_SQL_FILE="${SCRIPT_DIR}/sql/remote-data.sql"
DB_NAME="${D1_DATABASE_NAME:-navigation_db}"
SQL_FILE="${DEFAULT_SQL_FILE}"
SKIP_CONFIRM=0

print_help() {
  cat <<'EOF'
用法:
  bash scripts/sync-local.sh [options]

参数:
  --db <name>       本地 D1 数据库名称，默认 navigation_db，也可通过 D1_DATABASE_NAME 设置
  --file <path>     要同步的 SQL 文件，默认 scripts/sql/remote-data.sql
  --yes             跳过确认，直接执行本地同步
  --help            显示帮助信息

说明:
  该脚本直接执行远程导出的 SQL:
    npx wrangler d1 execute <db> --local --file=<sql-file>

  remote-data.sql 由 npm run export:remote-db 生成，通常包含 DELETE 和 INSERT。
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
  echo "请先运行: npm run export:remote-db" >&2
  exit 1
fi

if grep -Eiq '^[[:space:]]*(BEGIN([[:space:]]+TRANSACTION)?|COMMIT|SAVEPOINT|ROLLBACK|PRAGMA)([[:space:];=]|$)' "${SQL_FILE}"; then
  echo "SQL 文件包含 D1 不支持的事务或外键开关语句: ${SQL_FILE}" >&2
  echo "请重新运行: npm run export:remote-db" >&2
  exit 1
fi

echo "本地 D1 数据库: ${DB_NAME}"
echo "SQL 文件: ${SQL_FILE}"
echo
echo "注意: 该 SQL 可能会先删除本地表数据，再写入远程导出的数据。"

if [[ "${SKIP_CONFIRM}" -ne 1 ]]; then
  read -r -p "确认同步到本地 D1？输入 yes 继续: " CONFIRM
  if [[ "${CONFIRM}" != "yes" ]]; then
    echo "已取消"
    exit 0
  fi
fi

cd "${REPO_ROOT}"
npx wrangler d1 execute "${DB_NAME}" --local --file="${SQL_FILE}"
