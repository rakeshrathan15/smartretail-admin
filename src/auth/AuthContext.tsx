import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError, clearTokens, onSessionEnded, saveTokens, storedRefreshToken } from '../api/client'
import type { AuthResponse, UserSummary } from '../api/types'
import { AuthContext, type AuthState } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    storedRefreshToken() ? { status: 'loading' } : { status: 'signed-out' },
  )

  // Restore the session after a reload: /api/me fails with 401, and the client refreshes.
  useEffect(() => {
    if (state.status !== 'loading') return
    api<UserSummary>('/api/me')
      .then((user) => setState(user.roles.includes('ADMIN') ? { status: 'signed-in', user } : { status: 'signed-out' }))
      .catch(() => setState({ status: 'signed-out' }))
  }, [state.status])

  useEffect(() => onSessionEnded(() => setState({ status: 'signed-out' })), [])

  const login = useCallback(async (identifier: string, password: string) => {
    const response = await api<AuthResponse>('/api/auth/login', { method: 'POST', json: { identifier, password } })
    if (!response.user.roles.includes('ADMIN')) {
      // Sign the non-admin session out again so it is not left behind.
      await api('/api/auth/logout', { method: 'POST', json: { refreshToken: response.refreshToken } }).catch(() => {})
      throw new ApiError(403, 'This account is not an admin.')
    }
    saveTokens(response)
    setState({ status: 'signed-in', user: response.user })
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = storedRefreshToken()
    clearTokens()
    setState({ status: 'signed-out' })
    if (refreshToken) {
      await api('/api/auth/logout', { method: 'POST', json: { refreshToken } }).catch(() => {})
    }
  }, [])

  const value = useMemo(() => ({ state, login, logout }), [state, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
