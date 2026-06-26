# 本版本待发布事项

根据当前代码变动，本版本发布需要执行以下脚本：

## 1. 执行远程数据库迁移

```bash
./release.sh --migrate --migration db/migrations/20260625_add_password_vault_entries.sql
./release.sh --migrate --migration db/migrations/20260626_add_api_rate_limits.sql
```

原因：本版本启用了“随身记录”和接口限流，需要远程 D1 存在 `password_vault_entries`、`api_rate_limits` 表。已有远程库不要重新跑完整 `schema.sql`，用迁移脚本即可。

## 2. 设置远程环境变量

```bash
./release.sh --set-env
```

原因：本版本新增/使用 MyApp 同步环境变量：`MYAPP_BASE_URL`、`MYAPP_EXPORT_KEY`、`MYAPP_PAYLOAD_KEY_PREFIX`、`MYAPP_SYNC_SOURCE`。发布前先确认本地 `.dev.vars` 已填好，脚本会同步到 Cloudflare Pages。

## 3. 构建并部署

```bash
./release.sh --deploy
```

原因：本版本改了前端随身记录页面、图标、隐私状态处理，以及 Pages Functions 接口，需要重新构建并部署。

## 发布前建议检查

```bash
npx vue-tsc --noEmit
npm run build
git diff --check
```

原因：分别检查 TypeScript 类型、生产构建和补丁空白问题。

## 发布后确认

- 管理认证和隐私模式都正常。
- 隐私模式解锁后能打开“随身记录”。
- 普通账户、GPT 类账户、记录可以新增并刷新后解锁读取；普通账户分类不会出现在 GPT 类账户下。
- MyApp 拉取同步能成功预览并导入 `schemaVersion = 4` 的 `notes`、`accounts`。
- MyApp 推送同步会先显示被动同步预检结果，只确认选中的新增、更新或冲突项。
