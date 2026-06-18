# 快速上手指南

## 启动项目

```bash
npm install
npm run dev
npm run pages:dev
```

也可以先运行准备脚本：

```bash
./start-dev.sh
```

该脚本会安装缺失依赖，并检查 `.wrangler/state/v3/d1` 下是否存在任意 `.sqlite` 文件；没有本地 D1 SQLite 文件时，会自动执行 `db/schema.sql` 初始化本地数据库。

访问：

- 搜索页：http://localhost:5173
- 导航页：http://localhost:5173/sites

本地管理员令牌取决于 `.dev.vars` 中的 `ADMIN_TOKEN`，示例见项目根目录 `.dev.vars.example`。

## 初始化数据库

```bash
npx wrangler d1 execute navigation_db --local --file=./db/schema.sql
```

生产环境：

```bash
npx wrangler d1 execute navigation_db --remote --file=./db/schema.sql
```

## 常用功能

### 浏览站点

- `/sites` 查看导航主页
- 左侧分类切换分类
- 顶部搜索框会跨全部分类搜索站点名称和描述
- 点击卡片打开站点

### 搜索主页

- `/` 为搜索主页
- 支持 Google、Bing、百度、GitHub 搜索
- 快捷方式从 D1 读取，跨设备可用
- 管理员登录后可新增或删除快捷方式
- 从站点卡片加入快捷方式时会缓存可用 favicon，图标加载失败时显示字母图标

### 推荐站点

未认证访客可以在首页或搜索页右下角点击推荐图标：

1. 输入站点 URL
2. 点击 `自动提取`
3. 填写邮箱
4. 提交后等待管理员审核

投稿会进入 `site_submissions`，不会直接显示在导航站。
提交前会检测已收录和待审核 URL，重复时不允许提交。

### 审核投稿

1. 进入 `/sites`
2. 点击顶部认证按钮并输入管理员令牌
3. 点击顶部 `审核`
4. 可修改分类、图标、描述
5. 点击 `通过收录` 或 `拒绝`

### 管理站点

管理员在 `/sites` 认证后可：

- 新增站点
- 在右侧站点面板标题后方进入或退出编辑模式
- 进入编辑模式后编辑、删除、排序站点
- 新增/删除分类
- 拖拽分类调整顺序
- 同步 Cloudflare 项目
- 导入 Google 书签，支持搜索、分页、设置分类和一键剔除已存在重复项
- 点击站点卡片星标加入或移除搜索页快捷方式

新增、编辑和审核收录都会检测重复 URL。检测会忽略末尾 `/`、域名大小写和默认端口差异。

### 隐私空间

隐私空间分类默认隐藏。

1. 在站点页标题后方隐藏区域连续点击 6 次
2. 输入 `PRIVATE_PASSWORD`
3. 解锁后会出现 `隐私空间` 分类
4. 退出隐私模式后会重新隐藏

注意：

- 站点页要进入隐私模式才能查看隐私空间
- 管理员要进入隐私模式才能添加、编辑、删除隐私空间站点
- 所有分类下拉框也会遵守隐私模式

### 自定义外观

首页设置面板支持：

- 站点名称
- 主页 Logo
- 主题：毛玻璃、赛博朋克
- 背景：图片、粒子
- 顶部栏颜色、边框、透明度、字重
- 分类菜单颜色、选中背景、边框、透明度、字重
- 网站卡片颜色、边框、透明度、字重
- 新增预设、应用预设、初始化

预设会保存站点名称、Logo、主题、背景、粒子和外观配置。

## 图标规则

站点卡片图标显示优先级：

1. GitHub、Cloudflare 使用内置品牌 SVG
2. 其它真实 favicon 使用浅色底板和提亮阴影
3. 图标 URL 为空或加载失败时显示主题默认图标

图标字段可以留空。

## 环境变量

本地环境变量写在项目根目录 `.dev.vars`，该文件不提交；示例见 `.dev.vars.example`。

生产环境在 Cloudflare Pages 项目设置中配置同名变量。

- `ADMIN_TOKEN`：管理密钥，用于 `/sites` 认证入口。
- `PRIVATE_PASSWORD`：隐私模式密钥，用于解锁 `隐私空间`。

## 常用调试命令

```bash
npx vue-tsc --noEmit
npm run build
```

## 本地数据脚本

导出本地 D1 SQLite 数据为可导入 SQL：

```bash
npm run export:local-db
```

默认读取 `.wrangler/state/v3/d1` 下最新的 `.sqlite` 文件，输出到 `scripts/sql/local-data.sql`。生成的 SQL 会先对每张表执行 `DELETE`，再写入 `INSERT`，并且不包含显式事务语句，可直接用于 Wrangler 远程 D1 执行。

从远程 D1 导出数据并同步到本地：

```bash
npm run export:remote-db
npm run sync:local-db
```

默认输出到 `scripts/sql/remote-data.sql`。生成的 SQL 会先对每张表执行 `DELETE`，再按外键关系写入远程导出的 `INSERT`。

`scripts/sql/*.sql` 为本地导出数据，已在 `.gitignore` 中忽略。

查询待审核投稿：

```bash
npx wrangler d1 execute navigation_db --local --command "SELECT * FROM site_submissions WHERE status = 'pending'"
```

查询隐私分类站点：

```bash
npx wrangler d1 execute navigation_db --local --command "SELECT * FROM sites WHERE category = '隐私空间'"
```

## 常见问题

### 登录失败

检查 `.dev.vars` 或 Cloudflare Pages 环境变量中的 `ADMIN_TOKEN`。

### 隐私模式无法解锁

检查是否配置了 `PRIVATE_PASSWORD`。

### 投稿提交后看不到

这是正常的。投稿需要管理员在 `审核列表` 中通过后才会进入正式站点列表。

### VSCode / Vetur 报找不到 vue

项目已使用 `moduleResolution: "node"` 兼容 Vetur。若还有残留红线，重启 TS Server 或重新打开 VSCode。
