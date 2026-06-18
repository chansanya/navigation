import { defineStore } from 'pinia'
import { ref } from 'vue'

interface VerifyPrivacyResponse {
  valid: boolean
}

interface PrivacySessionResponse {
  unlocked: boolean
}

export const PRIVATE_CATEGORY_NAME = '隐私空间'

export const usePrivacyStore = defineStore('privacy', () => {
  const isUnlocked = ref(false)

  function clearLegacyPrivacyStorage() {
    if (typeof window === 'undefined') return
    window.sessionStorage.removeItem('navigation-privacy-token')
  }

  async function verifyPassword(password: string): Promise<boolean> {
    try {
      clearLegacyPrivacyStorage()
      const response = await fetch('/api/privacy/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      })
      const data = await response.json() as VerifyPrivacyResponse

      if (data.valid) {
        isUnlocked.value = true
        return true
      }

      isUnlocked.value = false
      return false
    } catch (error) {
      console.error('Privacy verification failed:', error)
      return false
    }
  }

  async function checkSession(): Promise<boolean> {
    try {
      clearLegacyPrivacyStorage()
      const response = await fetch('/api/privacy/session', {
        credentials: 'same-origin'
      })
      const data = await response.json() as PrivacySessionResponse

      isUnlocked.value = Boolean(data.unlocked)
      return isUnlocked.value
    } catch {
      isUnlocked.value = false
      return false
    }
  }

  async function lock() {
    try {
      await fetch('/api/privacy/logout', {
        method: 'POST',
        credentials: 'same-origin'
      })
    } finally {
      clearLegacyPrivacyStorage()
      isUnlocked.value = false
    }
  }

  function privacyHeaders(): Record<string, string> {
    return {}
  }

  clearLegacyPrivacyStorage()

  return {
    isUnlocked,
    verifyPassword,
    checkSession,
    lock,
    privacyHeaders
  }
})
