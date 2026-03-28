/* eslint-disable react-refresh/only-export-components */
/**
 * Niriksha — Auth Context
 * ========================
 * Global authentication state provider.
 * Stores JWT in localStorage, exposes user info to all components.
 * 
 * Usage:
 *   const { user, login, logout, isAuthenticated } = useAuthContext()
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { jwtDecode } from 'jwt-decode'

const AuthContext = createContext(null)

const TOKEN_KEY = 'niriksha_token'
const USER_KEY  = 'niriksha_user'

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Restore session from localStorage on mount ─────────────
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    const storedUser  = localStorage.getItem(USER_KEY)

    if (storedToken && storedUser) {
      try {
        // Check if token is expired
        const decoded = jwtDecode(storedToken)
        const isExpired = decoded.exp * 1000 < Date.now()

        if (!isExpired) {
          // Store user data to use after effect completes
          const userData = JSON.parse(storedUser)
          // Use microtask to defer state update
          queueMicrotask(() => setUser(userData))
        } else {
          // Token expired — clear storage
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(USER_KEY)
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }
    }
    queueMicrotask(() => setLoading(false))
  }, [])

  // ── Login: store token and user info ───────────────────────
  const login = useCallback((tokenData) => {
    const { access_token, user: userData } = tokenData
    localStorage.setItem(TOKEN_KEY, access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(userData))
    setUser(userData)
  }, [])

  // ── Logout: clear storage + state ─────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  // ── Update face embedding status after registration ────────
  const updateFaceStatus = useCallback((hasFace) => {
    if (!user) return
    const updated = { ...user, has_face_embedding: hasFace }
    setUser(updated)
    localStorage.setItem(USER_KEY, JSON.stringify(updated))
  }, [user])

  const value = {
    user,
    loading,
    login,
    logout,
    updateFaceStatus,
    isAuthenticated: !!user,
    isAdmin:    user?.role === 'admin',
    isStudent:  user?.role === 'student',
    token:      localStorage.getItem(TOKEN_KEY),
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook for easy consumption
export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}

export default AuthContext
