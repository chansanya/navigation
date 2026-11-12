# MCP 接入指南

Navigation 内置了基于 **Streamable HTTP** 传输协议的远程 MCP（Model Context Protocol）服务端点，随 Cloudflare Pages Functions 一同部署，复用现有 D1 数据库。

## 连接信息

- **端点 URL**：`https://<你的域名>/mcp`
- **传输方式**：Streamable HTTP
- **认证方式**：`Authorization: Bearer <MCP_API_TOKEN>`

::: warning 安全提醒
`MCP_API_TOKEN` 请使用独立的高熵随机字符串，不要与 `ADMIN_TOKEN` 或 `PRIVATE_PASSWORD` 复用。未配置时 `/mcp` 会返回 `503`。
:::

## 页面内快捷查看（仅管理员）

管理员在导航页 `/sites` 认证登录后，可点击右上角 **接入文档** 按钮打开内置 MCP 文档弹窗：

- 自动读取服务端 `MCP_API_TOKEN`（通过 `GET /api/mcp/config`，需管理员登录态且响应头设置 `Cache-Control: no-store`）
- 支持一键复制 MCP 接入地址、`MCP_API_TOKEN`、`Authorization` 请求头及完整客户端 JSON 配置

## 客户端配置示例

在支持远程 Streamable HTTP MCP 的客户端（如 Claude Desktop、Cursor、Antigravity 等）中添加如下配置：

```json
{
  "mcpServers": {
    "navigation": {
      "url": "https://<你的域名>/mcp",
      "headers": {
        "Authorization": "Bearer <你的 MCP_API_TOKEN>"
      }
    }
  }
}
```

## 可用工具列表

### 1. `list_site_categories`（只读）

列出导航站当前所有的公开分类（自动排除隐私空间）。在添加或修改站点分类前，AI 应先调用此工具获取准确分类名称。

### 2. `search_sites`（只读）

按关键词搜索导航站中已有的公开站点，返回站点 `id`、名称、URL、分类、描述和图标（最多返回 20 条）。

- `keyword`（必填）：搜索关键词，匹配站点名称、URL 或描述
- `category`（可选）：限定在指定分类内搜索

### 3. `preview_site`（只读预览）

检查目标 URL 是否有效、分类是否存在以及是否与已有站点重复，自动抓取网页标题、描述与图标，并生成一个 **10 分钟有效** 的签名确认凭证 `previewToken`。此工具不会写入数据库。

- `url`（必填）：HTTP/HTTPS 站点地址
- `category`（必填）：现有公开分类的准确名称
- `name`（可选）：覆盖自动提取的站点名称
- `description`（可选）：覆盖自动提取的站点描述
- `icon`（可选）：覆盖自动提取的公开 HTTP/HTTPS 图标地址

### 4. `add_site`（写入）

在用户确认预览内容后，使用 `preview_site` 返回的 `previewToken` 写入数据库。

- `previewToken`（必填）：短期签名确认凭证

### 5. `preview_update_site`（只读预览）

预览对已有站点的修改内容，校验目标站点、分类与 URL 查重后，生成 **10 分钟有效** 的签名确认凭证 `updateToken`。此工具不会写入数据库。

- `siteId`（必填）：要修改的站点 ID（通过 `search_sites` 获取）
- `name`（可选）：新的站点名称
- `url`（可选）：新的站点 URL
- `category`（可选）：新的公开分类名称
- `description`（可选）：新的站点描述
- `icon`（可选）：新的公开 HTTP/HTTPS 图标地址

### 6. `update_site`（写入）

在用户确认修改内容后，使用 `preview_update_site` 返回的 `updateToken` 将修改写入数据库。

- `updateToken`（必填）：短期签名确认凭证

## 典型调用流程

### 添加新站点

```text
list_site_categories  ──▶  preview_site(url, category)  ──▶  用户确认  ──▶  add_site(previewToken)
```

### 修改已有站点

```text
search_sites(keyword)  ──▶  preview_update_site(siteId, ...)  ──▶  用户确认  ──▶  update_site(updateToken)
```

## 安全机制

- **两步预览确认**：所有写入操作（新增、修改）均采用 `preview -> confirm` 两步流程，凭证通过 `MCP_API_TOKEN` 进行 HMAC-SHA256 签名，10 分钟过期且不可篡改字段。
- **上下文隔离**：新增凭证与修改凭证使用独立的签名前缀，不能互相混用。
- **隐私隔离**：MCP 无法读取、搜索、修改或新增 `隐私空间` 分类下的任何站点。
- **SSRF 与重复防护**：自动拦截内网/本地地址，并在预览与写入阶段双重检测重复 URL。

## 专属通用 Agent Skill（`navigation-site`）

仓库的 `skills/navigation-site/` 目录下提供了一份跨 Agent 通用的专属 Skill，用于指导各类 AI 助手完成“查分类 → 抓取预览 → 用户确认 → 写入/更新站点”全流程：

- `skills/navigation-site/SKILL.md`：通用技能指令（YAML Frontmatter + 工作流）
- `skills/navigation-site/references/mcp-clients.md`：各主流 Agent MCP 配置与 HTTP 降级调用示例
- `skills/navigation-site/agents/openai.yaml`：界面显示元数据

需要使用的用户可自行复制 `skills/navigation-site/` 到对应 Agent 的技能目录：

- **Antigravity / Codex / Cursor / Gemini CLI / OpenCode**：复制到 `~/.agents/skills/navigation-site/`（或目标项目 `.agents/skills/navigation-site/`）
- **Claude Code**：复制到 `~/.claude/skills/navigation-site/`（或目标项目 `.claude/skills/navigation-site/`）

也可以使用通用安装命令：

```bash
npx skills add chansanya/navigation --skill navigation-site
```
