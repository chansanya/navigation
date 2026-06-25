<template>
  <button
    type="button"
    class="privacy-hotspot"
    :class="{ unlocked: privacyStore.isUnlocked }"
    :title="privacyStore.isUnlocked ? '退出隐私模式' : ''"
    @click="handleClick"
  >
    <span v-if="privacyStore.isUnlocked">退出隐私模式</span>
  </button>

  <teleport to="body">
    <div v-if="showUnlockModal" class="privacy-modal-overlay" @click.self="closeUnlockModal">
      <form class="privacy-modal" @submit.prevent="submitPassword">
        <button class="privacy-close" type="button" title="关闭" @click="closeUnlockModal">×</button>
        <h2>隐私模式</h2>
        <p>输入隐私密码后解锁隐私空间。</p>
        <input
          ref="passwordInputEl"
          v-model="passwordInput"
          type="password"
          placeholder="请输入隐私密码"
          autocomplete="current-password"
        />
        <p v-if="unlockError" class="privacy-error">{{ unlockError }}</p>
        <div class="privacy-actions">
          <button type="button" class="btn-secondary" @click="closeUnlockModal">取消</button>
          <button type="submit" class="btn-primary" :disabled="unlockLoading || !passwordInput.trim()">
            {{ unlockLoading ? '验证中...' : '解锁' }}
          </button>
        </div>
      </form>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { usePrivacyStore } from '@/stores/privacy'

const emit = defineEmits<{
  changed: []
}>()

const privacyStore = usePrivacyStore()
const clickCount = ref(0)
const showUnlockModal = ref(false)
const passwordInput = ref('')
const unlockLoading = ref(false)
const unlockError = ref('')
const passwordInputEl = ref<HTMLInputElement | null>(null)
let resetTimer: number | undefined

async function handleClick() {
  if (privacyStore.isUnlocked) {
    // 已解锁时按钮变成显式退出入口，点击后刷新站点/分类数据。
    privacyStore.lock()
    emit('changed')
    return
  }

  clickCount.value += 1
  window.clearTimeout(resetTimer)
  // 隐藏入口需要在短时间内连续点击，避免普通点击标题区域误触发。
  resetTimer = window.setTimeout(() => {
    clickCount.value = 0
  }, 1800)

  if (clickCount.value < 6) return

  // 第 6 次点击才打开密码弹窗，打开后重置输入和错误状态。
  clickCount.value = 0
  showUnlockModal.value = true
  passwordInput.value = ''
  unlockError.value = ''
  await nextTick()
  passwordInputEl.value?.focus()
}

function closeUnlockModal() {
  if (unlockLoading.value) return
  showUnlockModal.value = false
  passwordInput.value = ''
  unlockError.value = ''
}

async function submitPassword() {
  const password = passwordInput.value.trim()
  if (!password || unlockLoading.value) return

  unlockLoading.value = true
  unlockError.value = ''

  // 隐私密码校验成功后，父组件会重新拉取包含隐私空间的数据。
  const valid = await privacyStore.verifyPassword(password)
  unlockLoading.value = false

  if (!valid) {
    unlockError.value = '隐私密码错误'
    return
  }

  showUnlockModal.value = false
  passwordInput.value = ''
  emit('changed')
}
</script>

<style scoped>
.privacy-hotspot {
  width: 42px;
  height: 32px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--appearance-topbar-text-color);
  cursor: default;
}

.privacy-hotspot.unlocked {
  width: auto;
  padding: 0 var(--spacing-md);
  border: 1px solid transparent;
  background: var(--appearance-topbar-control-bg);
  cursor: pointer;
  font-size: 13px;
  font-weight: var(--appearance-topbar-font-weight);
  white-space: nowrap;
}

.privacy-modal-overlay {
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

.privacy-modal {
  position: relative;
  width: min(100%, 380px);
  padding: 32px;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  text-align: center;
}

.privacy-close {
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

.privacy-close:hover {
  background: rgba(0, 0, 0, 0.07);
}

.privacy-modal h2 {
  font-size: 22px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.86);
}

.privacy-modal p {
  color: rgba(0, 0, 0, 0.58);
  font-size: 14px;
}

.privacy-modal input {
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

.privacy-modal input:focus {
  border-color: color-mix(in srgb, var(--primary-color) 70%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 16%, transparent);
}

.privacy-error {
  color: #ef4444 !important;
}

.privacy-actions {
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
