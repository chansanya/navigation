<template>
  <div class="auth-modal-overlay" @click.self="handleClose">
    <form class="auth-modal" @submit.prevent="handleLogin">
      <button class="auth-close" type="button" title="关闭" @click="handleClose">×</button>
      <img class="auth-logo" src="/logo.svg" alt="Nav" />
      <h2>管理员登录</h2>
      <p>输入管理员令牌后进入管理台。</p>

      <input
        ref="tokenInputEl"
        v-model="tokenInput"
        type="password"
        placeholder="请输入管理员令牌"
        autocomplete="current-password"
      />

      <p v-if="error" class="auth-error">{{ error }}</p>

      <div class="auth-actions">
        <button type="button" class="btn-secondary" @click="handleClose">取消</button>
        <button type="submit" class="btn-primary" :disabled="loading || !tokenInput.trim()">
          {{ loading ? '验证中...' : '登录' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits<{
  close: []
  success: []
}>()

const authStore = useAuthStore()
const tokenInput = ref('')
const loading = ref(false)
const error = ref('')
const tokenInputEl = ref<HTMLInputElement | null>(null)

onMounted(() => {
  // 弹窗打开后自动聚焦，管理员可以直接输入令牌。
  nextTick(() => tokenInputEl.value?.focus())
})

function handleClose() {
  // 验证请求进行中不允许关闭，避免用户误以为认证已经结束。
  if (loading.value) return
  emit('close')
}

async function handleLogin() {
  const token = tokenInput.value.trim()
  if (!token || loading.value) return

  loading.value = true
  error.value = ''

  // 实际令牌校验由服务端完成，前端只根据返回结果切换 UI。
  const success = await authStore.verifyToken(token)
  loading.value = false

  if (success) {
    emit('success')
    return
  }

  error.value = '令牌无效，请重试'
}
</script>

<style scoped>
.auth-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  padding: var(--spacing-lg);
  background: rgba(0, 0, 0, 0.56);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.auth-modal {
  position: relative;
  width: min(100%, 390px);
  padding: 34px;
  border: 1px solid rgba(255, 255, 255, 0.34);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  text-align: center;
}

.auth-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  color: rgba(0, 0, 0, 0.58);
  font-size: 22px;
  line-height: 1;
}

.auth-close:hover {
  background: rgba(0, 0, 0, 0.07);
}

.auth-logo {
  width: 52px;
  height: 52px;
  margin: 0 auto;
  object-fit: contain;
}

.auth-modal h2 {
  font-size: 24px;
  font-weight: 700;
}

.auth-modal p {
  color: rgba(0, 0, 0, 0.58);
  font-size: 14px;
}

.auth-modal input {
  width: 100%;
  height: 44px;
  border: 1px solid rgba(0, 0, 0, 0.14);
  border-radius: var(--radius-md);
  padding: 0 14px;
  background: rgba(255, 255, 255, 0.95);
  color: rgba(0, 0, 0, 0.86);
  font-size: 15px;
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.auth-modal input:focus {
  border-color: color-mix(in srgb, var(--primary-color) 70%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 16%, transparent);
}

.auth-error {
  color: #ef4444 !important;
}

.auth-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
}

.btn-secondary,
.btn-primary {
  height: 40px;
  border-radius: var(--radius-md);
  font-weight: 700;
}

.btn-secondary {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.68);
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}
</style>
