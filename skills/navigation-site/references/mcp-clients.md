# 各 Agent 通用 MCP 接入与降级调用参考

本导航站的 MCP 服务端点采用 **Streamable HTTP（Stateless JSON）** 传输：

- **Endpoint**: `https://<你的导航站域名>/mcp`
- **Authorization**: `Bearer <MCP_API_TOKEN>`

管理员登录导航站 `/sites` 后，点击右上角 **接入文档** 按钮可直接读取当前环境已生效的接入地址与 `MCP_API_TOKEN`。

---

## 1. 主流 Agent 客户端配置示例

### 通用 Streamable HTTP JSON 配置（Claude Desktop / Cursor / Windsurf / Antigravity 等）

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

### Claude Code CLI

```bash
claude mcp add --transport http navigation https://<你的域名>/mcp \
  --header "Authorization: Bearer <你的 MCP_API_TOKEN>"
```

### OpenAI Codex CLI (`~/.codex/config.toml`)

```toml
[mcp_servers.navigation]
url = "https://<你的域名>/mcp"
http_headers = { Authorization = "Bearer <你的 MCP_API_TOKEN>" }
```

### Gemini CLI (`~/.gemini/settings.json`)

```json
{
  "mcpServers": {
    "navigation": {
      "httpUrl": "https://<你的域名>/mcp",
      "headers": {
        "Authorization": "Bearer <你的 MCP_API_TOKEN>"
      }
    }
  }
}
```

---

## 2. 无原生 MCP 客户端时的 HTTP JSON-RPC 降级调用

如果当前运行中的 Agent 仅具备终端/HTTP 请求能力而未挂载 MCP 客户端工具，且用户已在环境变量中提供 `NAV_MCP_URL` 与 `NAV_MCP_TOKEN`，可直接按标准 MCP JSON-RPC 2.0 协议发送 `POST` 请求（必须同时携带 `Accept: application/json, text/event-stream`）：

### 查询分类 (`list_site_categories`)

```bash
curl -sS -X POST "$NAV_MCP_URL" \
  -H "Authorization: Bearer $NAV_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "list_site_categories",
      "arguments": {}
    }
  }'
```

### 预览新增站点 (`preview_site`)

```bash
curl -sS -X POST "$NAV_MCP_URL" \
  -H "Authorization: Bearer $NAV_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "preview_site",
      "arguments": {
        "url": "https://example.com",
        "category": "常用工具"
      }
    }
  }'
```

### 确认添加站点 (`add_site`)

```bash
curl -sS -X POST "$NAV_MCP_URL" \
  -H "Authorization: Bearer $NAV_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "add_site",
      "arguments": {
        "previewToken": "<preview_site 返回的 previewToken>"
      }
    }
  }'
```
