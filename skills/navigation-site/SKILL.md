---
name: navigation-site
description: >-
  通过导航站的远程 MCP 服务为使用者记录、分类、预览并添加新网站，或搜索并修改现有站点信息。
  当用户发来网址/链接/工具名称并希望“记录到导航”“收藏网站”“添加到某个分类”“整理书签”，
  或要求修改导航站中已有网站的名称、链接、分类、简介、图标时使用此技能。
---

# 导航站网站记录与管理技能

使用此技能通过导航站内置的远程 **MCP（Model Context Protocol）** 服务（`/mcp` 端点）为用户记录、添加或更新网站信息。所有写操作均强制采用 **预览（Preview）→ 用户确认 → 写入（Confirm）** 两步流程，防止误写入。

## 一、接入检查（首次使用或未挂载工具时）

在开始操作前，先确认当前对话环境中是否已挂载以下 6 个 MCP 工具：
- `list_site_categories`
- `search_sites`
- `preview_site`
- `add_site`
- `preview_update_site`
- `update_site`

若当前 Agent 尚未连接该 MCP 服务：
1. 告知用户连接信息：
   - **Endpoint**：`https://<你的导航站域名>/mcp`（本地调试为 `http://127.0.0.1:8788/mcp`）
   - **Transport**：Streamable HTTP
   - **Header**：`Authorization: Bearer <MCP_API_TOKEN>`
2. 提示用户获取 Token 的方式：以管理员身份登录导航站 `/sites` 页面，点击右上角 **接入文档** 按钮即可直接查看并复制完整客户端 JSON 配置（含 Token）。
3. 如需针对特定 Agent（Claude Code、Cursor、Codex、Antigravity、Gemini CLI 等）的配置模板或无 MCP 环境下的 HTTP 直连调用方式，参见 [references/mcp-clients.md](./references/mcp-clients.md)。

---

## 二、工作流 A：记录并添加新网站

当用户提供一个或多个网站并希望加入导航站时，严格按以下步骤执行：

### 1. 解析用户输入
从对话中提取：
- `url`（必填）：目标网址（即使用户只发了域名如 `github.com`，也可以直接传入，服务端会自动补全协议并规范化）
- `name`（可选）：用户指定的名称；未指定时留空，由 `preview_site` 自动抓取网页标题
- `description`（可选）：用户指定的简短说明；未指定时留空，由 `preview_site` 自动抓取网页 `meta description`
- `category`（可选）：用户指定的目标分类倾向
- `icon`（可选）：用户指定的图标 URL

### 2. 获取并匹配现有分类
调用 **`list_site_categories`** 获取当前导航站所有公开分类。
- 必须从返回的分类列表中选择**完全一致的分类名称**（MCP 不支持新建分类，且不可使用系统保留的 `隐私空间`）。
- 若用户未指定分类，根据网站用途选择最合适的一个现有分类；若存在多个合理选项，向用户给出 1~2 个推荐并询问确认。
- 若现有分类都不合适，提醒用户需先在导航站后台创建对应分类，再通过 MCP 添加。

### 3. 预览抓取与查重
调用 **`preview_site`**：
- 必填参数：`url`、`category`
- 可选参数：`name`、`description`、`icon`（仅在用户明确要求覆盖或你为网站补充了更清晰的中文简介时传入）

处理返回结果：
- **若返回 `duplicate_site`**：说明该站点已收录，向用户展示已存在的站点信息（`id`、`name`、`url`），询问是否改为更新现有站点信息（转入工作流 B）。
- **若预览成功**：记录返回的 `preview` 对象与 10 分钟有效的 `previewToken`。

### 4. 展示预览并等待用户确认（不可跳过）
向用户清晰展示即将收录的信息：
- 站点名称：`preview.name`
- 网址：`preview.url`
- 目标分类：`preview.category`
- 描述：`preview.description`（若自动提取为空或为英文，可主动帮用户拟一条简洁准确的中文描述供确认）

**等待用户明确回复确认后才能继续**。如果用户要求修改名称、分类或描述，使用更新后的参数重新调用 `preview_site` 生成新的 `previewToken`。

### 5. 确认写入
收到用户确认后，调用 **`add_site`**：
- 传入参数：`previewToken`
- 成功后向用户反馈已收录的站点 `id`、`name`、`url` 和 `category`。
- 若提示凭证过期（超过 10 分钟），重新执行第 3 步生成新凭证并再次确认。

---

## 三、工作流 B：修改现有网站信息

当用户要求修改导航站中已有站点的名称、网址、分类、描述或图标时，按以下步骤执行：

1. **搜索定位**：调用 **`search_sites`**（传入 `keyword`，可选 `category`），最多返回 20 条匹配记录。
   - 若命中多条记录，列出 `id`、`name`、`url`、`category` 让用户指定要修改哪一条。
   - 若未找到，提示用户换关键词重试，或确认该站点是否位于受保护的 `隐私空间`（MCP 不可访问）。
2. **校验新分类（如涉及换分类）**：若需要修改 `category`，先调用 **`list_site_categories`** 确认目标分类名精确存在。
3. **预览修改**：调用 **`preview_update_site`**，传入 `siteId` 以及发生变化的字段（`name`、`url`、`category`、`description`、`icon` 中至少一个）。
   - 若修改 `url` 时触发 `duplicate_site`，说明新地址与其它站点重复，停止并告知用户。
4. **对比确认（不可跳过）**：向用户展示 `currentSite` 与 `changes` 的修改前后对比，等待用户确认。
5. **确认写入**：用户同意后调用 **`update_site(updateToken)`** 完成更新，并反馈最新站点信息。

---

## 四、批量记录多个网站

当用户一次提供多个网址时：
1. 调用一次 **`list_site_categories`** 获取全部分类。
2. 逐个调用 **`preview_site`** 完成抓取、查重和分类匹配，保留各自对应的 `previewToken`。
3. 以表格形式汇总所有站点的 `名称 / URL / 建议分类 / 简介`（以及已存在的重复提示），请用户一次性确认（或微调某几项）。
4. 用户确认后，逐个调用 **`add_site`** 写入并汇总最终结果。

---

## 五、规则与边界

- **禁止绕过预览直接写入**：新增与修改都必须先调用 `preview_*` 并经用户确认后才能调用 `add_site` / `update_site`。
- **能力边界**：MCP 仅支持公开站点的查询、添加与修改；不支持删除站点、新建/修改分类、以及读取或写入 `隐私空间` 站点。
- **密钥安全**：绝不在输出、注释或仓库文件中泄露真实的 `MCP_API_TOKEN` 或 `ADMIN_TOKEN`。
