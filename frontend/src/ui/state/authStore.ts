import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type UserRole = 'Admin' | 'Analyst' | 'Viewer'

type AuthState = {
  accessToken: string | null
  refreshToken: string | null
  role: UserRole
  setTokens: (accessToken: string, refreshToken: string) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      role: 'Viewer',
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      clear: () => set({ accessToken: null, refreshToken: null, role: 'Viewer' }),
    }),
    {
      name: 'auth-storage', // name of item in the storage (must be unique)
    }
  )
)
