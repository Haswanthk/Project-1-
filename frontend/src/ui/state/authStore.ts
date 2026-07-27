import { create } from 'zustand'

type UserRole = 'Admin' | 'Analyst' | 'Viewer'

type AuthState = {
  accessToken: string | null
  refreshToken: string | null
  role: UserRole
  setTokens: (accessToken: string, refreshToken: string) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  role: 'Viewer',
  setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
  clear: () => set({ accessToken: null, refreshToken: null, role: 'Viewer' }),
}))

