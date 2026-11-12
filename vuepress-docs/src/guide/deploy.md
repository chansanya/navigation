# 部署指南

## 准备 D1 数据库

创建远程 D1 数据库：

```bash
npx wrangler d1 create navigation_db
```

复制 `wrangler.toml.example` 为本地 `wrangler.toml`，并将返回的 `database_id` 写入配置：

```toml
[[d1_databases]]
binding = "DB"
database_name = "navigation_db"
database_id = "<你的 database_id>"
```

::: tip 提示
`wrangler.toml` 默认不提交到仓库，公开仓库保留的是 `wrangler.toml.example`。
:::

## Cloudflare Pages 配置

在 Cloudflare Dashboard 中配置 Pages 项目：

### D1 绑定

- Variable name：`DB`
- D1 Database：`navigation_db`

### 环境变量

本地开发写入根目录 `.dev.vars`；生产环境在 Cloudflare Pages 项目的 `Settings -> Environment variables` 中配置：

| 变量名 | 必填 | 说明 |
| --- | --- | --- |
| `ADMIN_TOKEN` | 是 | 管理员认证密钥 |
| `PRIVATE_PASSWORD` | 推荐 | 隐私空间解锁密码 |
| `MCP_API_TOKEN` | 推荐 | 远程 MCP 专用高熵 Bearer Token（未配置时 `/mcp` 返回 `503`） |
| `CLOUDFLARE_API_TOKEN` | 可选 | 用于应用内同步 Cloudflare 项目 |
| `CLOUDFLARE_ACCOUNT_ID` | 可选 | Cloudflare 账号 ID |
| `MYAPP_BASE_URL` | 可选 | MyApp 随身记录同步地址 |
| `MYAPP_EXPORT_KEY` | 可选 | MyApp 同步导出密钥 |

## 构建与部署

```bash
npm run build
npm run pages:deploy
```

也可以使用根目录发布脚本按阶段执行：

```bash
./release.sh --init-db   # 初始化远程数据库
./release.sh --migrate   # 执行默认增量迁移脚本
./release.sh --set-env   # 从 .dev.vars 同步 Pages 环境变量
./release.sh --deploy    # 构建并部署
```

常规一键更新（环境变量同步 + 构建部署）：

```bash
./release.sh --all
```

单独设置远程 `MCP_API_TOKEN`：

```bash
printf '%s' '<高熵随机值>' | npx wrangler pages secret put MCP_API_TOKEN --project-name navigation
```

## 数据备份与同步

```bash
# 导出本地 D1 数据到 scripts/sql/local-data.sql
npm run export:local-db

# 将 local-data.sql 同步到远程 D1
npm run sync:remote-db

# 从远程 D1 导出数据到 scripts/sql/remote-data.sql
npm run export:remote-db

# 将 remote-data.sql 同步到本地 D1
npm run sync:local-db
```

## 验证命令

```bash
npx vue-tsc --noEmit
npm run build
```
