# 项目总结

## 当前能力

### 公开访问

- 搜索主页：搜索引擎切换、快捷方式、未认证访客推荐站点入口
- 导航主页：分类导航、全站搜索、站点卡片
- 公开投稿：未认证访客可提交精品站点推荐，需填写邮箱
- 推荐站点会检测已收录和待审核 URL，重复时不允许提交

### 管理能力

- 管理员令牌登录
- 站点 CRUD
- 分类新增、删除和排序
- Cloudflare 项目同步
- 投稿审核，通过后收录到正式站点
- 搜索主页快捷方式管理
- 新增、编辑和审核收录会检测重复 URL
- 编辑模式入口位于站点面板标题后方，退出编辑时使用醒目状态色
- Google 书签导入支持搜索、分页、分类设置和剔除已存在重复项

### 隐私空间

- 固定分类名：`隐私空间`
- 未解锁时 API 和前端均隐藏隐私空间
- 连续点击标题后隐藏区域 6 次后输入隐私密码解锁
- 解锁后可查看、添加、编辑、删除隐私空间站点
- 退出隐私模式后重新隐藏

### 外观系统

- 主题：毛玻璃、赛博朋克
- 背景：图片、粒子
- 可配置站点标题、主页 Logo
- 可配置顶部栏、分类菜单、网站卡片颜色、边框、透明度和字重
- 支持全局预设：保存标题、Logo、主题、背景、粒子和外观配置

### 图标系统

- GitHub、Cloudflare 使用内置 Simple Icons SVG
- 真实 favicon 使用浅色底板和增强阴影
- 加载失败或空图标使用主题默认图标
- 图标代理接口绕过部分防盗链问题
- 从站点卡片加入快捷方式时优先缓存可用 favicon，快捷方式图标失败时显示字母 fallback

## 技术架构

- Vue 3 + TypeScript + Vite
- Pinia 状态管理
- Cloudflare Pages Functions
- Cloudflare D1
- particles.js

## 主要目录

```text
src/
  views/
    SearchEngine.vue
    Home.vue
  components/
    common/
      SiteCard.vue
      SitesLayout.vue
      PrivacyHotspot.vue
      SiteSubmissionModal.vue
    admin/
      SiteEditor.vue
      CloudflareImport.vue
      SubmissionReviewModal.vue
    settings/
      PresetConfig.vue
      ThemeSwitcher.vue
      BackgroundConfig.vue
      AppearanceConfig.vue
  stores/
    auth.ts
    sites.ts
    settings.ts
    shortcuts.ts
    privacy.ts
functions/
  api/
    auth/
    sites/
      check-url.ts
    categories/
    settings/
    shortcuts/
    submissions/
    privacy/
    cloudflare/
    icon-proxy.ts
  db.ts
  _middleware.ts
db/
  schema.sql
wrangler.toml.example
docs/
  QUICKSTART.md
  DEPLOY.md
  PROJECT_SUMMARY.md
  DELIVERY_CHECKLIST.md
scripts/
  export-local-sqlite.js
  export-remote-d1.js
  sync-local.sh
  sync-remote.sh
  sql/
release.sh
```

## 本地脚本

- `start-dev.sh`：准备本地开发环境，检查依赖，并在 `.wrangler/state/v3/d1` 下没有任何 `.sqlite` 文件时初始化本地 D1 数据库
- `npm run export:local-db`：读取本地 D1 SQLite 数据并生成 SQL，默认输出 `scripts/sql/local-data.sql`
- `npm run sync:remote-db`：将 `scripts/sql/local-data.sql` 直接同步到远程 D1，实际执行 `scripts/sync-remote.sh`
- `npm run export:remote-db`：读取远程 D1 数据并生成 SQL，默认输出 `scripts/sql/remote-data.sql`
- `npm run sync:local-db`：将 `scripts/sql/remote-data.sql` 直接同步到本地 D1，实际执行 `scripts/sync-local.sh`
- `./release.sh --init-db|--set-env|--deploy|--all`：项目级发布脚本，分别执行初始化远程数据库、设置远程环境变量和远程部署

`scripts/sql/*.sql` 为本地生成数据，已在 `.gitignore` 中忽略。

## D1 表结构

URL 重复检测在 API 层完成，会规范化 http/https URL，忽略末尾 `/`、域名大小写和默认端口差异。当前实现不依赖额外唯一索引，兼容已有数据。

### sites

正式收录站点。

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
name TEXT NOT NULL
url TEXT NOT NULL
icon TEXT
category TEXT DEFAULT 'other'
description TEXT
sort INTEGER DEFAULT 0
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

### categories

分类列表，包含固定分类 `隐私空间`。

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
name TEXT NOT NULL UNIQUE
sort INTEGER DEFAULT 0
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

### settings

全局设置，以 JSON 字符串保存值。

```sql
key TEXT PRIMARY KEY
value TEXT NOT NULL
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

### shortcuts

搜索主页快捷方式。

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
site_id INTEGER
name TEXT NOT NULL
url TEXT NOT NULL UNIQUE
icon TEXT
sort INTEGER DEFAULT 0
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

### site_submissions

公开投稿审核队列。

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
name TEXT NOT NULL
url TEXT NOT NULL
icon TEXT
category TEXT DEFAULT '其他'
description TEXT
email TEXT NOT NULL
status TEXT DEFAULT 'pending'
review_note TEXT
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

## API 分类

公开：

- `GET /api/sites`
- `GET /api/sites/check-url`
- `GET /api/categories`
- `GET /api/settings`
- `GET /api/shortcuts`
- `POST /api/sites/extract`
- `POST /api/submissions`
- `POST /api/privacy/verify`
- `GET /api/icon-proxy`

管理：

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

隐私模式请求额外携带：

```http
X-Privacy-Token: <PRIVATE_PASSWORD>
```

## 环境变量

- `ADMIN_TOKEN`：管理员令牌，必填
- `PRIVATE_PASSWORD`：隐私空间密码，推荐
- `CLOUDFLARE_API_TOKEN`：Cloudflare 同步，可选
- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 同步，可选

本地开发使用 `.dev.vars`，该文件不提交；可提交的示例文件为 `.dev.vars.example`。
Cloudflare 本地配置使用 `wrangler.toml`，该文件不提交；可提交的示例文件为 `wrangler.toml.example`。

## 验证命令

```bash
npx vue-tsc --noEmit
npm run build
```

当前项目已通过 TypeScript 检查和生产构建。脚本层已验证 `start-dev.sh` 语法、本地/远程 D1 同步脚本语法和帮助信息。
