/**
 * Niriksha — Main Application Router (v2)
 * =========================================
 * Updated routing with:
 *  - AuthProvider wrapping all routes
 *  - Protected routes for exam, dashboard, admin
 *  - New login, signup, face-verify, result pages
 *  - AnimatePresence for smooth page transitions
 */
import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ErrorBoundary } from 'react-error-boundary'

// Route-level lazy imports keep the initial bundle lean.
const LandingPage = lazy(() => import('./pages/LandingPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const FaceVerifyPage = lazy(() => import('./pages/FaceVerifyPage'))
const ExamPage = lazy(() => import('./pages/ExamPage'))
const ResultPage = lazy(() => import('./pages/ResultPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))

// Auth
import ProtectedRoute  from './components/ProtectedRoute'

// Error Fallback
function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#030712' }}>
      <div className="glass-card p-8 max-w-md text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-gray-400 text-sm mb-4">{error?.message || 'An unexpected error occurred.'}</p>
        <button onClick={resetErrorBoundary} className="btn-primary px-6 py-2 text-sm">Reload Page</button>
      </div>
    </div>
  )
}

function App() {
  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<div className="min-h-screen" style={{ background: '#030712' }} />}>
        <Routes>
          {/* Public routes */}
          <Route path="/"         element={<LandingPage />} />
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/signup"   element={<SignupPage />} />

          {/* Student routes (require auth) */}
          <Route path="/face-verify" element={
            <ProtectedRoute requiredRole="student">
              <FaceVerifyPage />
            </ProtectedRoute>
          } />
          <Route path="/exam" element={
            <ProtectedRoute>
              <ErrorBoundary FallbackComponent={ErrorFallback}>
                <ExamPage />
              </ErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/result" element={
            <ProtectedRoute>
              <ResultPage />
            </ProtectedRoute>
          } />

          {/* Admin routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute requiredRole="admin">
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin">
              <AdminPage />
            </ProtectedRoute>
          } />
        </Routes>
      </Suspense>
    </AnimatePresence>
  )
}

export default App
