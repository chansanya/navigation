# 快速上手

## 本地启动

```bash
npm install
npm run dev
npm run pages:dev
```

也可以先运行准备脚本（会自动安装缺失依赖并在无本地 SQLite 文件时执行 `db/schema.sql` 初始化）：

```bash
./start-dev.sh
```

访问地址：

- 搜索页：`http://localhost:5173`
- 导航页：`http://localhost:5173/sites`
- Pages Functions：`http://localhost:8788`

本地管理员令牌与隐私密码配置在项目根目录 `.dev.vars` 中，示例见 `.dev.vars.example`。

## 初始化数据库

如果是第一次使用 Wrangler，或需要执行远程 D1 / Pages 操作，请先登录 Cloudflare：

```bash
npx wrangler login
npx wrangler whoami
```

初始化本地与生产 D1 数据库：

```bash
# 本地数据库
npx wrangler d1 execute navigation_db --local --file=./db/schema.sql

# 生产数据库
npx wrangler d1 execute navigation_db --remote --file=./db/schema.sql
```

已有远程数据库升级新功能时，执行 `db/migrations/` 下对应的独立增量脚本即可，无需重复执行整份初始化脚本：

```bash
npx wrangler d1 execute navigation_db --remote --file=./db/migrations/20260625_add_password_vault_entries.sql
npx wrangler d1 execute navigation_db --remote --file=./db/migrations/20260626_add_api_rate_limits.sql
```

## 常用功能

### 浏览与搜索

- `/` 为搜索主页，支持 Google、Bing、百度、GitHub 搜索，快捷方式从 D1 读取，跨设备同步
- `/sites` 为导航主页，左侧支持分类切换，顶部搜索框可跨全部分类搜索站点名称与描述

### 站点管理与编辑

管理员在 `/sites` 点击右上角认证按钮输入 `ADMIN_TOKEN` 登录后可：

- 新增、编辑、删除与拖拽排序站点
- 新增、重命名、删除与拖拽排序分类
- 同步 Cloudflare Pages/Workers 项目
- 导入浏览器书签（支持搜索、分页、批量分类与自动剔除重复 URL）
- 点击站点卡片星标加入或移除搜索页快捷方式
- 点击顶部文档按钮查看远程 MCP 接入信息

### 推荐投稿与审核

- 未认证访客点击右下角推荐图标即可提交站点，支持输入 URL 后自动提取标题、描述与图标
- 投稿先进入 `site_submissions` 表，管理员在顶部 `审核` 中确认通过或拒绝

### 隐私空间

隐私空间使用固定分类名 `隐私空间`，默认隐藏：

1. 在站点页标题后方隐藏区域连续点击 6 次
2. 输入 `PRIVATE_PASSWORD` 解锁
3. 解锁后可查看、新增、编辑、删除隐私空间站点，以及查看使用前端加密的随身记录

### 自定义外观

首页右侧设置面板支持配置：

- 站点名称与主页 Logo
- 主题切换：毛玻璃（`glass`）、赛博朋克（`cyberpunk`）
- 背景配置：图片、视频、粒子动画
- 顶栏、分类菜单、网站卡片的颜色、边框、透明度、字重
- 外观预设的新增、应用与初始化
