<template>
  <div class="docs-modal-overlay" @click.self="$emit('close')">
    <div class="docs-modal">
      <div class="docs-header">
        <h2>MCP 接入文档</h2>
        <button class="docs-close" type="button" title="关闭" @click="$emit('close')">×</button>
      </div>

      <div class="docs-body">
        <section class="docs-section">
          <h3>📡 接入地址</h3>
          <div class="docs-code-block">
            <code>{{ mcpEndpoint }}</code>
            <button
              class="btn-copy"
              type="button"
              title="复制"
              @click="copyToClipboard(mcpEndpoint, 'endpoint')"
            >
              {{ copiedField === 'endpoint' ? '✓' : '复制' }}
            </button>
          </div>
          <p class="docs-hint">MCP 协议端点，支持 Streamable HTTP 传输。</p>
        </section>

        <section class="docs-section">
          <h3>🔑 认证方式（MCP_API_TOKEN）</h3>
          <p>请求头携带 Bearer Token：</p>
          <div v-if="loadingConfig" class="docs-code-block">
            <code>正在读取 MCP_API_TOKEN...</code>
          </div>
          <div v-else-if="configError" class="docs-warning">
            {{ configError }}
          </div>
          <template v-else-if="mcpToken">
            <div class="docs-code-block">
              <code>{{ mcpToken }}</code>
              <button
                class="btn-copy"
                type="button"
                title="复制 Token"
                @click="copyToClipboard(mcpToken, 'token')"
              >
                {{ copiedField === 'token' ? '✓' : '复制' }}
              </button>
            </div>
            <div class="docs-code-block">
              <code>Authorization: Bearer {{ mcpToken }}</code>
              <button
                class="btn-copy"
                type="button"
                title="复制请求头"
                @click="copyToClipboard(`Authorization: Bearer ${mcpToken}`, 'header')"
              >
                {{ copiedField === 'header' ? '✓' : '复制' }}
              </button>
            </div>
          </template>
          <div v-else class="docs-warning">
            服务端尚未配置 <code>MCP_API_TOKEN</code> 环境变量，当前 <code>/mcp</code> 接口不可用（返回 503）。请在 <code>.dev.vars</code> 或 Cloudflare Pages 环境变量中配置后重新部署。
          </div>
          <p class="docs-hint">仅已登录管理员可见，Token 读取自服务端环境变量 <code>MCP_API_TOKEN</code>。</p>
        </section>

        <section class="docs-section">
          <h3>🛠️ 可用工具</h3>

          <div class="tool-card">
            <div class="tool-name">list_site_categories</div>
            <p>列出导航站现有的公开分类。添加站点前应先调用此工具选择准确分类。</p>
            <div class="tool-tag tag-read">只读</div>
          </div>

          <div class="tool-card">
            <div class="tool-name">search_sites</div>
            <p>按关键词搜索已有站点（匹配名称、URL、描述），返回站点 ID 和详情。</p>
            <div class="tool-params">
              <span class="param"><code>keyword</code> 搜索关键词</span>
              <span class="param"><code>category</code> 可选，限定分类</span>
            </div>
            <div class="tool-tag tag-read">只读</div>
          </div>

          <div class="tool-card">
            <div class="tool-name">preview_site</div>
            <p>检查 URL 和分类，自动抓取站点信息，生成 10 分钟有效的确认凭证。不写入数据库。</p>
            <div class="tool-params">
              <span class="param"><code>url</code> 站点地址</span>
              <span class="param"><code>category</code> 分类名称</span>
              <span class="param"><code>name</code> 可选覆盖</span>
              <span class="param"><code>description</code> 可选覆盖</span>
              <span class="param"><code>icon</code> 可选图标 URL</span>
            </div>
            <div class="tool-tag tag-read">只读（预览）</div>
          </div>

          <div class="tool-card">
            <div class="tool-name">add_site</div>
            <p>使用 <code>preview_site</code> 返回的凭证确认添加站点。</p>
            <div class="tool-params">
              <span class="param"><code>previewToken</code> 确认凭证</span>
            </div>
            <div class="tool-tag tag-write">写入</div>
          </div>

          <div class="tool-card">
            <div class="tool-name">preview_update_site</div>
            <p>预览对已有站点的修改，生成 10 分钟有效的确认凭证。</p>
            <div class="tool-params">
              <span class="param"><code>siteId</code> 站点 ID</span>
              <span class="param"><code>name</code> 可选新名称</span>
              <span class="param"><code>url</code> 可选新 URL</span>
              <span class="param"><code>category</code> 可选新分类</span>
              <span class="param"><code>description</code> 可选新描述</span>
              <span class="param"><code>icon</code> 可选新图标</span>
            </div>
            <div class="tool-tag tag-read">只读（预览）</div>
          </div>

          <div class="tool-card">
            <div class="tool-name">update_site</div>
            <p>使用 <code>preview_update_site</code> 返回的凭证确认修改。</p>
            <div class="tool-params">
              <span class="param"><code>updateToken</code> 确认凭证</span>
            </div>
            <div class="tool-tag tag-write">写入</div>
          </div>
        </section>

        <section class="docs-section">
          <h3>📋 调用流程</h3>
          <div class="flow-diagram">
            <div class="flow-group">
              <div class="flow-title">添加站点</div>
              <div class="flow-steps">
                <span class="flow-step">list_site_categories</span>
                <span class="flow-arrow">→</span>
                <span class="flow-step">preview_site</span>
                <span class="flow-arrow">→</span>
                <span class="flow-step step-confirm">用户确认</span>
                <span class="flow-arrow">→</span>
                <span class="flow-step step-write">add_site</span>
              </div>
            </div>
            <div class="flow-group">
              <div class="flow-title">修改站点</div>
              <div class="flow-steps">
                <span class="flow-step">search_sites</span>
                <span class="flow-arrow">→</span>
                <span class="flow-step">preview_update_site</span>
                <span class="flow-arrow">→</span>
                <span class="flow-step step-confirm">用户确认</span>
                <span class="flow-arrow">→</span>
                <span class="flow-step step-write">update_site</span>
              </div>
            </div>
          </div>
        </section>

        <section class="docs-section">
          <h3>⚙️ 客户端配置示例</h3>
          <p>在你的 MCP 客户端（如 Claude Desktop）中添加：</p>
          <div class="docs-code-block docs-code-multi">
            <pre><code>{{ configExample }}</code></pre>
            <button
              class="btn-copy"
              type="button"
              title="复制"
              @click="copyToClipboard(configExample, 'config')"
            >
              {{ copiedField === 'config' ? '✓' : '复制' }}
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

interface McpConfigResponse {
  success?: boolean
  configured?: boolean
  token?: string
  error?: string
}

defineEmits<{
  close: []
}>()

const copiedField = ref('')
const loadingConfig = ref(true)
const mcpToken = ref('')
const configError = ref('')

const siteOrigin = computed(() => {
  return window.location.origin
})

const mcpEndpoint = computed(() => {
  return `${siteOrigin.value}/mcp`
})

const configExample = computed(() => {
  const tokenText = mcpToken.value || '<你的 MCP_API_TOKEN>'
  return JSON.stringify({
    mcpServers: {
      navigation: {
        url: mcpEndpoint.value,
        headers: {
          Authorization: `Bearer ${tokenText}`
        }
      }
    }
  }, null, 2)
})

async function fetchMcpConfig() {
  loadingConfig.value = true
  configError.value = ''

  try {
    const response = await fetch('/api/mcp/config', {
      credentials: 'same-origin'
    })
    const data = await response.json() as McpConfigResponse

    if (!response.ok || !data.success) {
      configError.value = data.error || '读取 MCP 配置失败'
      mcpToken.value = ''
      return
    }

    mcpToken.value = data.token || ''
  } catch {
    configError.value = '读取 MCP 配置失败，请确认已启动 Pages Functions 服务'
    mcpToken.value = ''
  } finally {
    loadingConfig.value = false
  }
}

onMounted(() => {
  fetchMcpConfig()
})

async function copyToClipboard(text: string, field: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedField.value = field
    window.setTimeout(() => {
      if (copiedField.value === field) {
        copiedField.value = ''
      }
    }, 2000)
  } catch {
    // 剪贴板不可用时静默降级
  }
}
</script>

<style scoped>
.docs-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
}

.docs-modal {
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
  background: #ffffff;
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.docs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg) var(--spacing-xl);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.docs-header h2 {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.docs-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #6b7280;
  transition: background 0.15s;
}

.docs-close:hover {
  background: rgba(0, 0, 0, 0.08);
}

.docs-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg) var(--spacing-xl);
  scrollbar-width: thin;
}

.docs-section {
  margin-bottom: var(--spacing-xl);
}

.docs-section:last-child {
  margin-bottom: 0;
}

.docs-section h3 {
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 var(--spacing-sm) 0;
}

.docs-section p {
  font-size: 13px;
  color: #4b5563;
  margin: var(--spacing-xs) 0;
  line-height: 1.6;
}

.docs-hint {
  font-size: 12px !important;
  color: #9ca3af !important;
}

.docs-warning {
  padding: 10px 14px;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: var(--radius-md);
  color: #92400e;
  font-size: 12.5px;
  line-height: 1.5;
  margin: var(--spacing-sm) 0;
}

.docs-code-block {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 10px 14px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: var(--radius-md);
  margin: var(--spacing-sm) 0;
}

.docs-code-block code {
  flex: 1;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12.5px;
  color: #1f2937;
  word-break: break-all;
}

.docs-code-multi {
  align-items: flex-start;
}

.docs-code-multi pre {
  flex: 1;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.docs-code-multi code {
  word-break: break-all;
}

.btn-copy {
  flex-shrink: 0;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  background: #e5e7eb;
  color: #374151;
  font-size: 12px;
  font-weight: 500;
  transition: background 0.15s;
}

.btn-copy:hover {
  background: #d1d5db;
}

.tool-card {
  padding: 12px 14px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-sm);
}

.tool-card:last-child {
  margin-bottom: 0;
}

.tool-name {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
  font-weight: 600;
  color: #7c3aed;
  margin-bottom: 4px;
}

.tool-card p {
  font-size: 12.5px;
  color: #4b5563;
  margin: 2px 0 6px 0;
  line-height: 1.5;
}

.tool-params {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.param {
  font-size: 11.5px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 4px;
}

.param code {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  color: #2563eb;
  font-size: 11px;
}

.tool-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.tag-read {
  background: #dbeafe;
  color: #1d4ed8;
}

.tag-write {
  background: #fef3c7;
  color: #b45309;
}

.flow-diagram {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.flow-group {
  padding: 12px 14px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: var(--radius-md);
}

.flow-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.flow-steps {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.flow-step {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 11.5px;
  padding: 4px 10px;
  background: #e0e7ff;
  color: #3730a3;
  border-radius: 4px;
  font-weight: 500;
}

.flow-arrow {
  color: #9ca3af;
  font-size: 14px;
}

.step-confirm {
  background: #fef3c7;
  color: #92400e;
}

.step-write {
  background: #d1fae5;
  color: #065f46;
}

@media (max-width: 640px) {
  .docs-modal {
    max-height: 95vh;
  }

  .docs-header {
    padding: var(--spacing-md);
  }

  .docs-body {
    padding: var(--spacing-md);
  }

  .flow-steps {
    flex-direction: column;
    align-items: flex-start;
  }

  .flow-arrow {
    transform: rotate(90deg);
    margin-left: 16px;
  }
}
</style>
