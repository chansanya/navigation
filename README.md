# Nav

基于 Vue 3 + Cloudflare Pages Functions + D1 的现代化个人导航站。首页公开访问，管理员通过令牌登录后可管理站点、外观、快捷方式、Cloudflare 项目同步和用户投稿审核。

## 功能特性

- 公开浏览导航站，按分类展示站点卡片
- 顶部站点搜索，支持跨全部分类按名称和描述搜索
- 搜索主页，支持搜索引擎切换和 D1 持久化快捷方式
- 管理员令牌认证后可新增、编辑、删除站点和分类
- 新增、编辑、推荐和审核收录都会检测重复 URL，避免重复站点入库
- Cloudflare Pages/Workers 项目同步，已存在 URL 自动识别
- 未认证访客可在首页和搜索页右下角提交推荐站点，管理员审核后收录
- 隐私空间分类，需连续点击标题后隐私入口 6 次并输入隐私密码后解锁
- 外观设置支持站点标题、主页 Logo、主题、图片/视频/粒子背景、顶部栏/菜单/卡片颜色、透明度和字重
- 全局预设可保存标题、Logo、主题、图片/视频/粒子背景和外观配置
- 站点图标支持代理加载、主题默认图标、GitHub/Cloudflare 品牌 SVG 优先显示

## 技术栈

- Vue 3 + TypeScript + Vite
- Pinia + Vue Router
- Cloudflare Pages Functions
- Cloudflare D1
- particles.js

## 项目文档

- [快速上手](docs/QUICKSTART.md)
- [部署指南](docs/DEPLOY.md)

## 快速开始

```bash
npm install
```

首次使用 Wrangler 或需要执行远程 D1/Pages 操作时，先登录 Cloudflare：

```bash
npx wrangler login
npx wrangler whoami
```

创建 D1 数据库：

```bash
npx wrangler d1 create navigation_db
```

复制 `wrangler.toml.example` 为本地 `wrangler.toml`，将返回的 `database_id` 写入 `wrangler.toml` 后初始化数据库：

```bash
npx wrangler d1 execute navigation_db --local --file=./db/schema.sql
npx wrangler d1 execute navigation_db --remote --file=./db/schema.sql
```

本地环境变量写在 `.dev.vars`，该文件不提交；示例见 `.dev.vars.example`。

启动开发服务：

```bash
npm run dev
npm run pages:dev
```

构建：

```bash
npm run build
```

部署：

```bash
npm run pages:deploy
```

也可以使用根目录发布脚本分步执行：

```bash
./release.sh --init-db
./release.sh --set-env
./release.sh --deploy
```

完整发布：

```bash
./release.sh --all
```

导出本地 D1 SQLite 数据为可导入 SQL：

```bash
npm run export:local-db
```

默认输出到 `scripts/sql/local-data.sql`，生成的 SQL 可直接用于 Wrangler 远程 D1 执行。

从远程 D1 导出数据并同步到本地：

```bash
npm run export:remote-db
npm run sync:local-db
```

默认输出到 `scripts/sql/remote-data.sql`。

## Cloudflare Pages 配置

部署后在 Pages 项目中配置：

- D1 绑定：`DB`
- 环境变量：`ADMIN_TOKEN`
- 可选隐私密码：`PRIVATE_PASSWORD`
- 可选 Cloudflare 同步：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`

## 密钥说明

- `ADMIN_TOKEN` 是管理密钥。管理员在 `/sites` 点击认证入口后输入它，认证后才能审核投稿、同步 Cloudflare 项目、导入书签、新增站点、进入编辑模式和打开外观设置。
- `PRIVATE_PASSWORD` 是隐私模式密钥。用户在站点页标题后方隐藏区域连续点击 6 次后输入它，解锁后才能查看和管理 `隐私空间` 分类。
- 这两个密钥用途不同，建议设置为不同的高强度字符串。不要把真实密钥写入公开仓库。

## 数据库表

- `sites`：正式收录站点
- `categories`：分类列表，包含固定分类 `隐私空间`
- `settings`：全局设置和预设
- `shortcuts`：搜索主页快捷方式
- `site_submissions`：公开投稿，审核通过后复制进 `sites`

## 使用说明

### 普通访问

- `/` 为搜索主页，可搜索 Web，也可打开快捷方式
- `/sites` 为导航主页，可浏览和搜索站点
- 未认证时右下角推荐图标可提交精品站点推荐，需要填写邮箱
- 推荐提交会自动检测已收录和待审核 URL，重复时不允许提交

### 管理站点

1. 访问 `/sites`
2. 点击顶部认证按钮并输入 `ADMIN_TOKEN`
3. 认证后可审核投稿、同步 Cloudflare 项目、导入书签、新增站点
4. 右侧站点面板标题后方可进入或退出编辑模式，退出编辑按钮会以醒目颜色显示
5. 编辑模式下可编辑、删除、排序站点和分类
6. 点击卡片星标可加入或移除搜索页快捷方式，快捷方式会缓存可用 favicon 并在加载失败时显示字母图标
7. 新增和编辑站点会自动检测重复 URL，重复时不允许保存

### 隐私空间

- 在站点页标题后面的隐藏区域连续点击 6 次
- 输入 `PRIVATE_PASSWORD`
- 解锁后会显示 `隐私空间` 分类和 `退出隐私模式`
- 只有隐私模式下才能查看、添加、编辑、删除隐私空间站点

## API 概览

公开端点：

- `GET /api/sites`
- `GET /api/sites/check-url`
- `GET /api/categories`
- `GET /api/settings`
- `GET /api/shortcuts`
- `POST /api/sites/extract`
- `POST /api/submissions`
- `POST /api/privacy/verify`
- `GET /api/icon-proxy`

管理端点：

- `POST /api/auth/verify`
- `POST /api/sites`
- `PUT /api/sites/:id`
- `DELETE /api/sites/:id`
- `POST /api/categories`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`
- `PUT /api/settings`
- `POST /api/shortcuts`
- `DELETE /api/shortcuts/:id`
- `GET /api/submissions`
- `PUT /api/submissions/:id`
- `GET /api/cloudflare/projects`

管理员登录和隐私模式都使用服务端签名的 `HttpOnly` Cookie，会话密钥不会写入 localStorage 或 sessionStorage。

URL 重复检测会规范化 http/https URL，忽略末尾 `/`、域名大小写和默认端口差异。

## 编辑器提示

项目为了兼容 Vetur，将 `tsconfig.json` 的 `moduleResolution` 设置为 `node`。如果 VSCode 仍提示找不到 `vue`，重启 TS Server 或重新打开窗口。
