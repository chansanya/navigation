# 项目交付清单

## 核心功能

- [x] 公开搜索主页
- [x] 公开导航主页
- [x] 管理员令牌登录
- [x] 站点 CRUD
- [x] 分类管理和排序
- [x] 全站搜索站点名称和描述
- [x] D1 持久化快捷方式
- [x] Cloudflare 项目同步
- [x] 公开推荐站点投稿
- [x] 管理员投稿审核
- [x] 新增、编辑、推荐和审核收录 URL 重复检测
- [x] Google 书签导入搜索、分页和剔除重复
- [x] 隐私空间解锁、查看和管理

## 外观功能

- [x] 毛玻璃主题
- [x] 赛博朋克主题
- [x] 图片背景
- [x] 粒子背景
- [x] 自定义站点标题
- [x] 自定义主页 Logo
- [x] 顶部栏、分类菜单、网站卡片样式配置
- [x] 全局预设新增和应用
- [x] 主题默认站点图标
- [x] GitHub / Cloudflare 品牌图标优化
- [x] favicon 浅色底板和可读性增强

## 后端与数据库

- [x] Cloudflare Pages Functions
- [x] D1 绑定 `DB`
- [x] `sites` 表
- [x] `categories` 表
- [x] `settings` 表
- [x] `shortcuts` 表
- [x] `site_submissions` 表
- [x] 管理接口 token 鉴权
- [x] 隐私接口 `X-Privacy-Token` 过滤
- [x] CORS 允许 `X-Privacy-Token`
- [x] `GET /api/sites/check-url` 重复 URL 检查接口

## 环境变量

必填：

- [x] `ADMIN_TOKEN`

推荐：

- [x] `PRIVATE_PASSWORD`

可选：

- [x] `CLOUDFLARE_API_TOKEN`
- [x] `CLOUDFLARE_ACCOUNT_ID`

## 主要文件

- [x] `README.md`
- [x] `docs/DEPLOY.md`
- [x] `docs/QUICKSTART.md`
- [x] `docs/PROJECT_SUMMARY.md`
- [x] `docs/DELIVERY_CHECKLIST.md`
- [x] `.dev.vars.example`
- [x] `wrangler.toml.example`
- [x] `db/schema.sql`
- [x] `start-dev.sh`
- [x] `release.sh`
- [x] `scripts/export-local-sqlite.js`
- [x] `scripts/export-remote-d1.js`
- [x] `scripts/sync-local.sh`
- [x] `scripts/sync-remote.sh`
- [x] `functions/_middleware.ts`
- [x] `functions/db.ts`
- [x] `src/views/SearchEngine.vue`
- [x] `src/views/Home.vue`
- [x] `src/components/common/SiteCard.vue`
- [x] `src/components/common/SitesLayout.vue`
- [x] `src/components/common/SiteSubmissionModal.vue`
- [x] `src/components/common/PrivacyHotspot.vue`
- [x] `src/components/admin/SiteEditor.vue`
- [x] `src/components/admin/BookmarkImport.vue`
- [x] `src/components/admin/SubmissionReviewModal.vue`
- [x] `src/stores/privacy.ts`
- [x] `src/stores/shortcuts.ts`

## 验证

- [x] `npx vue-tsc --noEmit`
- [x] `npm run build`
- [x] `bash -n start-dev.sh`
- [x] `bash -n release.sh`
- [x] `node scripts/export-local-sqlite.js --help`
- [x] `node scripts/export-remote-d1.js --help`
- [x] `bash scripts/sync-local.sh --help`
- [x] `bash scripts/sync-remote.sh --help`

## 部署步骤

```bash
npm install
npx wrangler d1 execute navigation_db --remote --file=./db/schema.sql
npm run build
npm run pages:deploy
```

部署后确认：

- [ ] Pages 项目已绑定 D1：`DB`
- [ ] 已配置 `ADMIN_TOKEN`
- [ ] 如需隐私空间，已配置 `PRIVATE_PASSWORD`
- [ ] 如需同步 Cloudflare 项目，已配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`
