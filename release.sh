#!/usr/bin/env bash

set -euo pipefail

PROJECT_NAME=""
DB_NAME=""
ENV_FILE=".dev.vars"
SCHEMA_FILE="db/schema.sql"
DIST_DIR="dist"
RUN_INIT_DB=0
RUN_SET_ENV=0
RUN_DEPLOY=0
SKIP_CONFIRM=0

print_help() {
  cat <<'EOF'
用法:
  ./release.sh [options]

动作:
  --init-db          初始化远程 D1 数据库，执行 db/schema.sql
  --set-env          读取 .dev.vars 并设置必要的 Pages 远程环境变量
  --deploy           构建并部署到 Cloudflare Pages
  --all              依次执行 --init-db、--set-env、--deploy

参数:
  --project <name>   Pages 项目名，默认读取 wrangler.toml 的 name
  --db <name>        D1 数据库名，默认读取 wrangler.toml 的 database_name
  --env-file <path>  环境变量文件，默认 .dev.vars
  --schema <path>    数据库 schema 文件，默认 db/schema.sql
  --yes              跳过确认
  --help             显示帮助信息

示例:
  ./release.sh --init-db
  ./release.sh --set-env
  ./release.sh --deploy
  ./release.sh --all
  ./release.sh --all --project navigation --db navigation_db

说明:
  .dev.vars 不会提交到仓库；示例文件是 .dev.vars.example。
  只设置 ADMIN_TOKEN 和 PRIVATE_PASSWORD，不会打印变量值。
EOF
}

read_toml_value() {
  local key="$1"
  local file="${2:-wrangler.toml}"

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

  echo "初始化远程 D1 数据库: ${DB_NAME}"
  npx wrangler d1 execute "${DB_NAME}" --remote --file="${SCHEMA_FILE}"
}

set_remote_env() {
  echo "设置 Cloudflare Pages 远程环境变量"
  load_env_file "${ENV_FILE}"

  set_pages_secret ADMIN_TOKEN
  set_pages_secret PRIVATE_PASSWORD
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
    --set-env)
      RUN_SET_ENV=1
      shift
      ;;
    --deploy)
      RUN_DEPLOY=1
      shift
      ;;
    --all)
      RUN_INIT_DB=1
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

if [[ "${RUN_INIT_DB}" -eq 0 && "${RUN_SET_ENV}" -eq 0 && "${RUN_DEPLOY}" -eq 0 ]]; then
  print_help
  exit 0
fi

PROJECT_NAME="${PROJECT_NAME:-$(read_toml_value name)}"
DB_NAME="${DB_NAME:-$(read_toml_value database_name)}"

if [[ -z "${PROJECT_NAME}" ]]; then
  echo "Pages 项目名不能为空，请使用 --project 指定" >&2
  exit 1
fi

if [[ "${RUN_INIT_DB}" -eq 1 && -z "${DB_NAME}" ]]; then
  echo "D1 数据库名不能为空，请使用 --db 指定" >&2
  exit 1
fi

confirm_release

if [[ "${RUN_INIT_DB}" -eq 1 ]]; then
  init_remote_db
fi

if [[ "${RUN_SET_ENV}" -eq 1 ]]; then
  set_remote_env
fi

if [[ "${RUN_DEPLOY}" -eq 1 ]]; then
  deploy_pages
fi

echo "发布动作完成"
