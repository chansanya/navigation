import { defineStore } from 'pinia'
import { ref } from 'vue'

interface VerifyTokenResponse {
  valid: boolean
}

interface AuthSessionResponse {
  authenticated: boolean
}

function clearLegacyAuthStorage() {
  if (typeof window === 'undefined') return
  // 旧版本曾把认证态放在 localStorage；现在改用 HttpOnly Cookie，启动时清掉遗留明文。
  window.localStorage.removeItem('auth')
}

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref<boolean>(false)

  async function verifyToken(inputToken: string): Promise<boolean> {
    try {
      clearLegacyAuthStorage()
      // 管理令牌只提交给服务端校验，前端只保存“是否已认证”的布尔状态。
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: inputToken })
      })

      const data = await response.json() as VerifyTokenResponse

      if (data.valid) {
        isAuthenticated.value = true
        return true
      } else {
        isAuthenticated.value = false
        return false
      }
    } catch (error) {
      console.error('Token verification failed:', error)
      return false
    }
  }

  async function checkSession(): Promise<boolean> {
    try {
      clearLegacyAuthStorage()
      // 页面刷新后通过服务端签名 Cookie 恢复认证态，不依赖本地存储。
      const response = await fetch('/api/auth/session', {
        credentials: 'same-origin'
      })
      const data = await response.json() as AuthSessionResponse

      isAuthenticated.value = Boolean(data.authenticated)
      return isAuthenticated.value
    } catch {
      isAuthenticated.value = false
      return false
    }
  }

  async function logout() {
    try {
      // 退出时让服务端清 Cookie；finally 中同步清前端状态，保证 UI 立即收起管理入口。
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin'
      })
    } finally {
      clearLegacyAuthStorage()
      isAuthenticated.value = false
    }
  }

  clearLegacyAuthStorage()

  return {
    isAuthenticated,
    verifyToken,
    checkSession,
    logout
  }
})
