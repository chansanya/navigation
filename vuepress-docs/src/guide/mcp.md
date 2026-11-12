# MCP 接入指南

Navigation 内置了基于 **Streamable HTTP** 传输协议的远程 MCP（Model Context Protocol）服务端点，随 Cloudflare Pages Functions 一同部署，复用现有 D1 数据库。

## 连接信息

- **端点 URL**：`https://<你的域名>/mcp`
- **传输方式**：Streamable HTTP
- **认证方式**：`Authorization: Bearer <MCP_API_TOKEN>`

::: warning 安全提醒
`MCP_API_TOKEN` 请使用独立的高熵随机字符串，不要与 `ADMIN_TOKEN` 或 `PRIVATE_PASSWORD` 复用。未配置时 `/mcp` 会返回 `503`。
:::

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
