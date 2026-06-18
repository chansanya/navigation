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
  window.localStorage.removeItem('auth')
}

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref<boolean>(false)

  async function verifyToken(inputToken: string): Promise<boolean> {
    try {
      clearLegacyAuthStorage()
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
