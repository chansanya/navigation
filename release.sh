#!/usr/bin/env bash

set -euo pipefail

PROJECT_NAME=""
DB_NAME=""
ENV_FILE=".dev.vars"
SCHEMA_FILE="db/schema.sql"
MIGRATION_FILE="db/migrations/20260626_add_api_rate_limits.sql"
DIST_DIR="dist"
RUN_INIT_DB=0
RUN_MIGRATE_DB=0
RUN_SET_ENV=0
RUN_DEPLOY=0
SKIP_CONFIRM=0

print_help() {
  cat <<'EOF'
用法:
  ./release.sh [options]

动作:
  --init-db          初始化远程 D1 数据库，执行 db/schema.sql
  --migrate          执行单独的远程 D1 增量迁移脚本
  --set-env          读取 .dev.vars 并设置必要的 Pages 远程环境变量
  --deploy           构建并部署到 Cloudflare Pages
  --all              依次执行 --set-env、--deploy；初始化数据库必须显式执行 --init-db

参数:
  --project <name>   Pages 项目名，默认读取 wrangler.toml 的 name
  --db <name>        D1 数据库名，默认读取 wrangler.toml 的 database_name
  --env-file <path>  环境变量文件，默认 .dev.vars
  --schema <path>    数据库 schema 文件，默认 db/schema.sql
  --migration <path> 增量迁移 SQL 文件，默认 db/migrations/20260626_add_api_rate_limits.sql
  --yes              跳过确认
  --help             显示帮助信息

示例:
  ./release.sh --init-db
  ./release.sh --migrate
  ./release.sh --set-env
  ./release.sh --deploy
  ./release.sh --all
  ./release.sh --all --project navigation --db navigation_db

说明:
  .dev.vars 不会提交到仓库；示例文件是 .dev.vars.example。
  会设置 ADMIN_TOKEN、PRIVATE_PASSWORD 和已配置的 MyApp 同步变量，不会打印变量值。
EOF
}

read_toml_value() {
  local key="$1"
  local file="${2:-wrangler.toml}"

  # 发布脚本默认从 wrangler.toml 读项目和数据库名，允许命令行参数覆盖。
  if [[ ! -f "${file}" ]]; then
    return 0
  fi

  sed -n "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*\"\\([^\"]*\\)\"[[:space:]]*$/\\1/p" "${file}" | head -n 1
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "${value}"
}

load_env_file() {
  local env_file="$1"

  if [[ ! -f "${env_file}" ]]; then
    echo "环境变量文件不存在: ${env_file}" >&2
    echo "请参考 .dev.vars.example 创建 .dev.vars" >&2
    exit 1
  fi

  local line key value
  while IFS= read -r line || [[ -n "${line}" ]]; do
    # 只支持简单 KEY=VALUE 格式；复杂 shell 表达式不会被执行，避免误执行本地脚本。
    line="$(trim "${line}")"
    [[ -z "${line}" || "${line}" == \#* ]] && continue
    [[ "${line}" != *=* ]] && continue

    key="$(trim "${line%%=*}")"
    value="${line#*=}"
    value="$(trim "${value}")"

    if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "${value}" == \'*\' && "${value}" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi

    if [[ -n "${key}" && -n "${value}" ]]; then
      export "${key}=${value}"
    fi
  done < "${env_file}"
}

set_pages_secret() {
  local key="$1"
  local value="${!key:-}"

  if [[ -z "${value}" ]]; then
    echo "跳过 ${key}: 未配置"
    return
  fi

  # 通过 stdin 传 secret，避免密钥出现在命令行参数或 shell 历史中。
  echo "设置远程环境变量: ${key}"
  printf '%s' "${value}" | npx wrangler pages secret put "${key}" --project-name "${PROJECT_NAME}"
}

confirm_release() {
  if [[ "${SKIP_CONFIRM}" -eq 1 ]]; then
    return
  fi

  echo "Pages 项目: ${PROJECT_NAME}"
  echo "D1 数据库: ${DB_NAME}"
  echo "环境变量文件: ${ENV_FILE}"
  if [[ "${RUN_MIGRATE_DB}" -eq 1 ]]; then
    echo "迁移脚本: ${MIGRATION_FILE}"
  fi
  echo
  read -r -p "确认执行发布动作？输入 yes 继续: " confirm
  if [[ "${confirm}" != "yes" ]]; then
    echo "已取消"
    exit 0
  fi
}

init_remote_db() {
  if [[ ! -f "${SCHEMA_FILE}" ]]; then
    echo "数据库 schema 文件不存在: ${SCHEMA_FILE}" >&2
    exit 1
  fi

  # 初始化脚本用于全新数据库；已有线上库升级新功能时优先使用 migrate_remote_db。
  echo "初始化远程 D1 数据库: ${DB_NAME}"
  npx wrangler d1 execute "${DB_NAME}" --remote --file="${SCHEMA_FILE}"
}

migrate_remote_db() {
  if [[ ! -f "${MIGRATION_FILE}" ]]; then
    echo "数据库迁移文件不存在: ${MIGRATION_FILE}" >&2
    exit 1
  fi

  # 增量迁移脚本必须独立、可重复执行，避免线上已有数据被初始化流程影响。
  echo "执行远程 D1 增量迁移: ${MIGRATION_FILE}"
  npx wrangler d1 execute "${DB_NAME}" --remote --file="${MIGRATION_FILE}"
}

set_remote_env() {
  echo "设置 Cloudflare Pages 远程环境变量"
  load_env_file "${ENV_FILE}"

  set_pages_secret ADMIN_TOKEN
  set_pages_secret PRIVATE_PASSWORD
  set_pages_secret MYAPP_BASE_URL
  set_pages_secret MYAPP_EXPORT_KEY
  set_pages_secret MYAPP_PAYLOAD_KEY_PREFIX
  set_pages_secret MYAPP_SYNC_SOURCE
}

deploy_pages() {
  echo "构建项目"
  npm run build

  if [[ ! -d "${DIST_DIR}" ]]; then
    echo "构建目录不存在: ${DIST_DIR}" >&2
    exit 1
  fi

  echo "部署 Cloudflare Pages: ${PROJECT_NAME}"
  npx wrangler pages deploy "${DIST_DIR}" --project-name "${PROJECT_NAME}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --init-db)
      RUN_INIT_DB=1
      shift
      ;;
    --migrate)
      RUN_MIGRATE_DB=1
      shift
      ;;
    --set-env)
      RUN_SET_ENV=1
      shift
      ;;
    --deploy)
      RUN_DEPLOY=1
      shift
      ;;
    --all)
      # --all 面向常规发布；初始化和迁移都必须显式声明，避免误操作线上 D1。
      RUN_SET_ENV=1
      RUN_DEPLOY=1
      shift
      ;;
    --project)
      PROJECT_NAME="${2:-}"
      shift 2
      ;;
    --db)
      DB_NAME="${2:-}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --schema)
      SCHEMA_FILE="${2:-}"
      shift 2
      ;;
    --migration)
      MIGRATION_FILE="${2:-}"
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

if [[ "${RUN_INIT_DB}" -eq 0 && "${RUN_MIGRATE_DB}" -eq 0 && "${RUN_SET_ENV}" -eq 0 && "${RUN_DEPLOY}" -eq 0 ]]; then
  print_help
  exit 0
fi

PROJECT_NAME="${PROJECT_NAME:-$(read_toml_value name)}"
DB_NAME="${DB_NAME:-$(read_toml_value database_name)}"

if [[ -z "${PROJECT_NAME}" ]]; then
  echo "Pages 项目名不能为空，请使用 --project 指定" >&2
  exit 1
fi

if [[ ("${RUN_INIT_DB}" -eq 1 || "${RUN_MIGRATE_DB}" -eq 1) && -z "${DB_NAME}" ]]; then
  echo "D1 数据库名不能为空，请使用 --db 指定" >&2
  exit 1
fi

confirm_release

if [[ "${RUN_INIT_DB}" -eq 1 ]]; then
  init_remote_db
fi

if [[ "${RUN_MIGRATE_DB}" -eq 1 ]]; then
  migrate_remote_db
fi

if [[ "${RUN_SET_ENV}" -eq 1 ]]; then
  set_remote_env
fi

if [[ "${RUN_DEPLOY}" -eq 1 ]]; then
  deploy_pages
fi

echo "发布动作完成"
