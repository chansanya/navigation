import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface VerifyPrivacyResponse {
  valid: boolean
}

const SESSION_KEY = 'navigation-privacy-token'

export const PRIVATE_CATEGORY_NAME = '隐私空间'

export const usePrivacyStore = defineStore('privacy', () => {
  const token = ref<string>(window.sessionStorage.getItem(SESSION_KEY) || '')
  const isUnlocked = computed(() => Boolean(token.value))

  async function verifyPassword(password: string): Promise<boolean> {
    try {
      const response = await fetch('/api/privacy/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      })
      const data = await response.json() as VerifyPrivacyResponse

      if (data.valid) {
        token.value = password
        window.sessionStorage.setItem(SESSION_KEY, password)
        return true
      }

      return false
    } catch (error) {
      console.error('Privacy verification failed:', error)
      return false
    }
  }

  function lock() {
    token.value = ''
    window.sessionStorage.removeItem(SESSION_KEY)
  }

  function privacyHeaders(): Record<string, string> {
    if (!token.value) return {}
    return {
      'X-Privacy-Token': token.value
    }
  }

  return {
    token,
    isUnlocked,
    verifyPassword,
    lock,
    privacyHeaders
  }
})
