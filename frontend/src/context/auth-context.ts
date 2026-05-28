import { createContext } from 'react'
import type { SessionUser } from '../auth/role'

export type AuthContextValue = {
  user: SessionUser | null
  loading: boolean
  setUser: (user: SessionUser | null) => void
  refreshUser: () => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
