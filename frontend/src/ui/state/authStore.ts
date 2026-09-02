import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type UserRole = 'Admin' | 'Analyst' | 'Viewer'

export interface AuthUser {
  id: number
  email: string
  full_name: string
  role: UserRole
}

type AuthState = {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  role: UserRole
  setTokens: (accessToken: string, refreshToken: string) => void
  setUser: (user: AuthUser) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      role: 'Viewer',
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user, role: user.role }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null, role: 'Viewer' }),
    }),
    {
      name: 'auth-storage',
    }
  )
)
