/**
 * Niriksha — Login Page
 * ======================
 * JWT-based login with role detection.
 * Redirects students → face verify, admins → dashboard.
 */
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ShieldCheckIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useAuthContext } from '../context/AuthContext'
import { authAPI } from '../api/client'
import { motion } from 'framer-motion'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated, user } = useAuthContext()

  const [form, setForm] = useState({ email: '', password: '', role: 'student' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return
    const redirectPath = user?.role === 'admin' ? '/dashboard' : '/face-verify'
    navigate(redirectPath, { replace: true })
  }, [isAuthenticated, user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      toast.error('Please fill in all fields')
      return
    }
    setLoading(true)
    try {
      const { data } = await authAPI.login(form)
      login(data) // store token + user in context/localStorage

      toast.success(`Welcome back, ${data.user.name}! 👋`)

      // Redirect based on role
      if (data.user.role === 'admin') {
        navigate('/dashboard')
      } else {
        // Students go to face verification before exam
        navigate('/face-verify')
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Login failed. Check your credentials.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center"
         style={{ background: 'radial-gradient(ellipse at 50% 0%, #0f172a 0%, #030712 70%)' }}>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md mx-4"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
               style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            <ShieldCheckIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white">Niriksha</h1>
          <p className="text-gray-400 text-sm mt-1">AI-Powered Exam Proctoring</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8" style={{ border: '1px solid rgba(59,130,246,0.15)' }}>
          <h2 className="text-xl font-bold text-white mb-6">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="you@university.edu"
                className="input-dark text-sm"
                autoComplete="email"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  className="input-dark text-sm pr-10"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPass ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Role Validation UI */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">Login As</label>
              <div className="grid grid-cols-2 gap-2">
                {['student', 'admin'].map(r => (
                  <button key={r} type="button"
                    onClick={() => setForm(p => ({ ...p, role: r }))}
                    className="py-2.5 rounded-xl text-sm font-medium capitalize transition-all"
                    style={{
                      background: form.role === r ? (r === 'admin' ? 'rgba(139,92,246,0.2)' : 'rgba(59,130,246,0.2)') : 'rgba(255,255,255,0.03)',
                      border: form.role === r ? `1px solid ${r === 'admin' ? 'rgba(139,92,246,0.4)' : 'rgba(59,130,246,0.4)'}` : '1px solid rgba(255,255,255,0.08)',
                      color: form.role === r ? (r === 'admin' ? '#c4b5fd' : '#93c5fd') : '#64748b',
                    }}
                  >
                    {r === 'student' ? '🎓 Student' : '👨‍🏫 Admin'}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="btn-primary w-full py-3 mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : 'Sign In'}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/05" />
            <span className="text-xs text-gray-600">Don't have an account?</span>
            <div className="flex-1 h-px bg-white/05" />
          </div>

          <Link to="/signup">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-xl font-semibold text-sm text-blue-400 transition-all"
              style={{ border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.05)' }}
            >
              Create Account
            </motion.button>
          </Link>
        </div>

        {/* Demo accounts hint */}
        <div className="mt-4 p-4 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-xs text-gray-500">
            First time? <Link to="/signup" className="text-blue-400 hover:text-blue-300">Register</Link> to create your account.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
