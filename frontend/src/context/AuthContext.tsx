import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api/api'
import type { SessionUser } from '../auth/role'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function refreshUser() {
    setLoading(true)
    try {
      const response = await api.get('/api/v1/auth/me')
      setUser(response.data?.data ?? null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    try {
      await api.post('/api/v1/auth/logout')
    } finally {
      setUser(null)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshUser()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, setUser, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
