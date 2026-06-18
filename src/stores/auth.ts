import { defineStore } from 'pinia'
import { ref } from 'vue'

interface VerifyTokenResponse {
  valid: boolean
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>('')
  const isAuthenticated = ref<boolean>(false)

  async function verifyToken(inputToken: string): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: inputToken })
      })

      const data = await response.json() as VerifyTokenResponse

      if (data.valid) {
        token.value = inputToken
        isAuthenticated.value = true
        return true
      } else {
        return false
      }
    } catch (error) {
      console.error('Token verification failed:', error)
      return false
    }
  }

  function login(inputToken: string) {
    token.value = inputToken
    isAuthenticated.value = true
  }

  function logout() {
    token.value = ''
    isAuthenticated.value = false
  }

  return {
    token,
    isAuthenticated,
    verifyToken,
    login,
    logout
  }
}, {
  persist: true
})
