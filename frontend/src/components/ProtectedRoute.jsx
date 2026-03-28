/**
 * Niriksha — Protected Route Component
 * ======================================
 * Wraps routes that require authentication or specific roles.
 * Redirects unauthenticated users to /login.
 * Redirects unauthorized roles to appropriate pages.
 * 
 * Usage:
 *   <ProtectedRoute requiredRole="admin">
 *     <DashboardPage />
 *   </ProtectedRoute>
 */
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext'

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, loading, isAuthenticated } = useAuthContext()
  const location = useLocation()

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#030712' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Verifying session...</p>
        </div>
      </div>
    )
  }

  // Not logged in → send to login with return path
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Wrong role → redirect appropriately
  if (requiredRole && user?.role !== requiredRole) {
    if (requiredRole === 'admin') {
      return <Navigate to="/" replace />
    }
    return <Navigate to="/" replace />
  }

  return children
}
