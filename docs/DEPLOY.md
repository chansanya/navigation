# 部署指南

## 本地开发

安装依赖：

```bash
npm install
```

登录 Cloudflare 账号：

```bash
npx wrangler login
npx wrangler whoami
```

创建远程 D1、执行远程 SQL、设置 Pages 环境变量和部署 Pages 都需要 Wrangler 已登录。

本地环境变量写在项目根目录 `.dev.vars`，该文件不提交；示例见 `.dev.vars.example`。

启动：

```bash
npm run dev
npm run pages:dev
```

准备本地环境：

```bash
./start-dev.sh
```

`start-dev.sh` 会检查 `.wrangler/state/v3/d1` 下是否存在任意 `.sqlite` 文件；不存在时自动执行本地数据库初始化。它不会绑定某个固定的 Miniflare SQLite 文件名。

访问：

- 前端：http://localhost:5173
- Pages Functions：http://localhost:8788
- 站点页：http://localhost:5173/sites

## D1 数据库

创建数据库：

```bash
npx wrangler d1 create navigation_db
```

复制 `wrangler.toml.example` 为本地 `wrangler.toml`，把返回的 `database_id` 写入 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "navigation_db"
database_id = "..."
```

`wrangler.toml` 包含本地真实 D1 资源 ID，默认不提交；公开仓库提交的是 `wrangler.toml.example`。

初始化本地和远程数据库：

```bash
npx wrangler d1 execute navigation_db --local --file=./db/schema.sql
npx wrangler d1 execute navigation_db --remote --file=./db/schema.sql
```

`db/schema.sql` 主要用于首次初始化。已有远程数据库升级新功能时，不要直接混跑整份初始化脚本，优先执行对应的独立迁移脚本：

```bash
npx wrangler d1 execute navigation_db --remote --file=./db/migrations/20260625_add_password_vault_entries.sql
npx wrangler d1 execute navigation_db --remote --file=./db/migrations/20260626_add_api_rate_limits.sql
```

当前 schema 包含：

- `sites`
- `categories`
- `settings`
- `shortcuts`
- `site_submissions`
- `password_vault_entries`
- `api_rate_limits`

运行时也会自动兜底创建 `shortcuts`、`site_submissions`、`password_vault_entries`、`api_rate_limits` 和 `隐私空间` 分类，但首次部署仍建议执行 `schema.sql`。
重复 URL 检测在 API 层完成，不依赖额外唯一索引。
从随身记录版本开始，新增数据库结构都应放在 `db/migrations/` 下单独建增量脚本，线上已有库按需执行对应迁移。
随身记录的账号、记录、Tab 显示设置和账号分类设置都存放在同一张密文表里，不需要额外 D1 表；账号分为普通账户和 GPT 类账户，只有普通账户维护账号分类；旧版账单密文会在解锁后自动清理。

## Cloudflare Pages 部署

构建并部署：

```bash
npm run build
npm run pages:deploy
```

也可以使用根目录发布脚本按阶段执行：

```bash
./release.sh --init-db   # 初始化远程数据库
./release.sh --migrate   # 执行默认增量迁移脚本
./release.sh --set-env   # 从 .dev.vars 设置必要的 Pages 远程环境变量
./release.sh --deploy    # 构建并部署
```

一次执行常规发布：

```bash
./release.sh --all
```

`--all` 只会执行 `--set-env` 和 `--deploy`，不会初始化数据库，也不会自动执行 `--migrate`。已有远程数据库升级时，先明确执行迁移，再部署：

```bash
./release.sh --migrate --migration db/migrations/20260625_add_password_vault_entries.sql
./release.sh --migrate --migration db/migrations/20260626_add_api_rate_limits.sql
./release.sh --deploy
```

默认读取 `wrangler.toml` 中的 Pages 项目名和 D1 数据库名，也可通过参数覆盖：

```bash
./release.sh --all --project navigation --db navigation_db
```

`--set-env` 会设置 `ADMIN_TOKEN`、`PRIVATE_PASSWORD` 和已配置的 MyApp 同步变量。`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` 属于应用内 Cloudflare 项目同步功能的可选配置，需要时可在 Cloudflare Pages 控制台单独配置。

在 Cloudflare Dashboard 中配置 Pages 项目：

### D1 绑定

- Variable name：`DB`
- D1 Database：`navigation_db`

### 环境变量

本地开发时写入项目根目录 `.dev.vars`，示例见 `.dev.vars.example`；生产环境在 Cloudflare Pages 项目的 Settings -> Environment variables 中配置。

必填：

- `ADMIN_TOKEN`：管理密钥。管理员在 `/sites` 点击认证入口后输入该值，认证后才能审核投稿、同步 Cloudflare 项目、导入书签、新增站点、进入编辑模式和修改外观设置。

推荐配置：

- `PRIVATE_PASSWORD`：隐私模式密钥。用户在站点页标题后方隐藏区域连续点击 6 次后输入该值，解锁后才能查看和管理 `隐私空间` 分类。

Cloudflare 项目同步可选：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

MyApp 随身记录同步可选：

- `MYAPP_BASE_URL`
- `MYAPP_EXPORT_KEY`
- `MYAPP_PAYLOAD_KEY_PREFIX`，默认兼容 `myapp-export-payload-v1:`
- `MYAPP_SYNC_SOURCE`，默认 `navigation`，用于 MyApp 被动同步来源标识

拉取同步适配 MyApp `schemaVersion = 4` 导出结构，主路径读取 `notes`、`accounts`，账户 `accountType` 会保存为账号分类；旧版 `codeAccounts` 仅作为兼容 fallback。同步到 MyApp 时，会先调用 MyApp 被动同步预检接口，用户确认选中的新增、更新或冲突项后再写入。

建议 `ADMIN_TOKEN` 和隐私模式密钥使用不同的高强度字符串。修改生产环境变量后，需要重新部署或重新启动 Pages Functions 运行环境后生效。

## 隐私空间

隐私空间使用固定分类名 `隐私空间`。

- 未解锁时，站点、分类、快捷方式接口都不会返回隐私空间数据
- 解锁方式：在站点页标题后方隐藏区域连续点击 6 次，然后输入隐私密码
- 解锁后浏览器会携带服务端签名的 `HttpOnly` Cookie
- 管理员只有在隐私模式下才能新增、编辑、删除隐私空间站点

## 投稿审核

未认证访客在首页或搜索页右下角点击推荐图标后提交站点。投稿会进入 `site_submissions` 表，不会直接进入正式 `sites`。

管理员在 `/sites` 认证后点击顶部 `审核`：

- `通过收录`：复制到 `sites` 表，并把投稿标记为 `approved`
- `拒绝`：把投稿标记为 `rejected`

新增站点、编辑站点、提交推荐和审核通过都会检测重复 URL。检测会规范化 URL，忽略末尾 `/`、域名大小写和默认端口差异；已收录或待审核重复项会被拒绝。

## 数据库管理命令

查询站点：

```bash
npx wrangler d1 execute navigation_db --remote --command "SELECT * FROM sites"
```

查询待审核投稿：

```bash
npx wrangler d1 execute navigation_db --remote --command "SELECT * FROM site_submissions WHERE status = 'pending'"
```

查询设置：

```bash
npx wrangler d1 execute navigation_db --remote --command "SELECT * FROM settings"
```

导出本地 D1 SQLite 数据：

```bash
npm run export:local-db
```

默认输出到 `scripts/sql/local-data.sql`，可通过 `--db` 指定 SQLite 文件，通过 `--out` 指定输出路径。生成的 SQL 已经兼容 Wrangler 远程 D1 执行，不包含 `BEGIN`、`COMMIT`、`SAVEPOINT`、`ROLLBACK` 等显式事务语句。

将 `scripts/sql/local-data.sql` 同步到远程 D1：

```bash
npm run sync:remote-db
```

该命令会执行 `scripts/sync-remote.sh`，默认同步到 `navigation_db`。脚本直接执行 `scripts/sql/local-data.sql`。如需指定数据库：

```bash
bash scripts/sync-remote.sh --db navigation_db
```

`local-data.sql` 通常包含 `DELETE` 和 `INSERT`，执行前会要求输入 `yes` 确认。自动化环境可加 `--yes` 跳过确认。

从远程 D1 导出数据：

```bash
npm run export:remote-db
```

默认输出到 `scripts/sql/remote-data.sql`。该命令会按业务表逐个调用 Wrangler 远程导出，并生成可直接同步到本地 D1 的数据 SQL。

将 `scripts/sql/remote-data.sql` 同步到本地 D1：

```bash
npm run sync:local-db
```

该命令会执行 `scripts/sync-local.sh`，默认同步到本地 `navigation_db`。如需指定数据库：

```bash
bash scripts/sync-local.sh --db navigation_db
```

`remote-data.sql` 通常包含 `DELETE` 和 `INSERT`，执行前会要求输入 `yes` 确认。自动化环境可加 `--yes` 跳过确认。

`scripts/sql/*.sql` 属于本地生成数据，默认不提交到版本库。

## 常见问题

### API 返回 401

检查 `ADMIN_TOKEN` 是否配置正确，前端登录使用的令牌是否一致。

### 隐私空间无法解锁

确认已配置 `PRIVATE_PASSWORD`，并重新部署或重新启动 `pages:dev`。

### Cloudflare 项目同步失败

确认 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 已配置，API Token 需要有读取 Pages/Workers 项目的权限。

### 图标太暗看不清

卡片会优先使用 GitHub/Cloudflare 内置品牌 SVG；其它 favicon 会加浅色底板和提亮阴影。图标 URL 加载失败时会显示主题默认图标。
从站点卡片加入搜索页快捷方式时会优先缓存可用 favicon，快捷方式图标失败时显示字母 fallback。

### Vetur 报 Cannot find module 'vue'

项目已将 `tsconfig.json` 的 `moduleResolution` 设置为 `node` 以兼容 Vetur。若仍有红线，重启 VSCode 的 TS Server。

## 验证命令

```bash
npx vue-tsc --noEmit
npm run build
```
