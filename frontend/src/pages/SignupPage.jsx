/**
 * Niriksha — Signup Page (with Face Registration)
 * =================================================
 * Multi-step signup:
 *   Step 1: Fill in name, email, password, role
 *   Step 2: Capture face via webcam (for identity registration)
 *   Step 3: Submit → JWT returned → redirect
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import Webcam from 'react-webcam'
import {
  ShieldCheckIcon, UserIcon, CameraIcon,
  CheckCircleIcon, EyeIcon, EyeSlashIcon,
} from '@heroicons/react/24/outline'
import { useAuthContext } from '../context/AuthContext'
import { authAPI } from '../api/client'

const STEPS = ['Account Info', 'Face Registration', 'Complete']

export default function SignupPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated, user, updateFaceStatus } = useAuthContext()
  const webcamRef = useRef(null)

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [capturedFace, setCapturedFace] = useState(null)  // base64 JPEG
  const [faceEmbedding, setFaceEmbedding] = useState(null)
  const [registeredUser, setRegisteredUser] = useState(null)

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPwd: '', role: 'student',
  })
  const Motion = motion

  useEffect(() => {
    if (!isAuthenticated) return

    // Stay on signup while this page is actively completing
    // step-by-step onboarding (account -> face registration -> complete).
    if (step > 0 || registeredUser) return

    const redirectPath = user?.role === 'admin' ? '/dashboard' : '/face-verify'
    navigate(redirectPath, { replace: true })
  }, [isAuthenticated, user, navigate, step, registeredUser])

  // ── Step 1: Register account ──────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) {
      toast.error('Please fill in all fields')
      return
    }
    if (form.password !== form.confirmPwd) {
      toast.error('Passwords do not match')
      return
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      const { data } = await authAPI.register({
        name: form.name, email: form.email,
        password: form.password, role: form.role,
      })
      setRegisteredUser(data)
      login(data)  // Store JWT immediately
      toast.success('Account created! Now register your face.')
      setStep(1)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Registration failed. Email may already be in use.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Capture face from webcam ─────────────────────────
  const captureFace = useCallback(() => {
    if (!webcamRef.current) return
    const screenshot = webcamRef.current.getScreenshot()
    if (!screenshot) { toast.error('Could not capture image'); return }
    // Strip data URL prefix to get raw base64
    const b64 = screenshot.split(',')[1]
    setCapturedFace(screenshot)
    setFaceEmbedding(b64)
    toast.success('Face captured! Click "Register Face" to save.')
  }, [])

  const handleFaceRegister = async () => {
    if (!faceEmbedding || !registeredUser) {
      toast.error('Please capture your face first')
      return
    }
    setLoading(true)
    try {
      const userId = registeredUser.user.id
      await authAPI.registerFace(userId, faceEmbedding)
      updateFaceStatus(true)
      toast.success('Face registered successfully! ✅')
      setStep(2)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Face registration failed. Please try again.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const skipFace = () => {
    toast('Face registration skipped. You can do this later.')
    setStep(2)
  }

  const handleFinish = () => {
    const role = registeredUser?.user?.role
    if (role === 'admin') navigate('/dashboard')
    else navigate('/face-verify')
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-8"
         style={{ background: 'radial-gradient(ellipse at 50% 0%, #0f172a 0%, #030712 70%)' }}>

      <Motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-4"
      >
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
               style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            <ShieldCheckIcon className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">Create Account</h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: i <= step ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'rgba(255,255,255,0.05)',
                  color: i <= step ? '#fff' : '#64748b',
                }}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${i === step ? 'text-blue-300' : 'text-gray-600'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-white/10 ml-1" />}
            </div>
          ))}
        </div>

        <div className="glass-card p-8" style={{ border: '1px solid rgba(59,130,246,0.15)' }}>
          <AnimatePresence mode="wait">

            {/* ── STEP 0: Account Info ── */}
            {step === 0 && (
              <Motion.form
                key="step0"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                onSubmit={handleRegister}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Full Name</label>
                  <input className="input-dark text-sm" placeholder="John Smith"
                    value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Email Address</label>
                  <input type="email" className="input-dark text-sm" placeholder="john@university.edu"
                    value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} className="input-dark text-sm pr-10"
                      placeholder="Min 6 characters" value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showPass ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Confirm Password</label>
                  <input type="password" className="input-dark text-sm" placeholder="Repeat password"
                    value={form.confirmPwd} onChange={e => setForm(p => ({ ...p, confirmPwd: e.target.value }))} required />
                </div>

                {/* Role selector */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Account Type</label>
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
                        {r === 'student' ? '🎓 Student' : '👨‍🏫 Teacher'}
                      </button>
                    ))}
                  </div>
                </div>

                <Motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="btn-primary w-full py-3 mt-1 flex items-center justify-center gap-2">
                  {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating...</> : 'Continue →'}
                </Motion.button>
              </Motion.form>
            )}

            {/* ── STEP 1: Face Registration ── */}
            {step === 1 && (
              <Motion.div key="step1"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-4">
                <div className="text-center mb-2">
                  <CameraIcon className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                  <h3 className="font-semibold text-white">Face Registration</h3>
                  <p className="text-xs text-gray-400 mt-1">This face will be used to verify your identity before each exam</p>
                </div>

                {/* Webcam / Preview */}
                {capturedFace ? (
                  <div className="relative rounded-xl overflow-hidden" style={{ border: '2px solid rgba(16,185,129,0.4)' }}>
                    <img src={capturedFace} alt="Captured" className="w-full rounded-xl" style={{ maxHeight: '220px', objectFit: 'cover' }} />
                    <div className="absolute top-2 right-2 bg-green-500/80 rounded-full px-2 py-1 text-xs font-bold">✓ Captured</div>
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden" style={{ border: '2px solid rgba(59,130,246,0.3)' }}>
                    <Webcam ref={webcamRef} audio={false} className="w-full rounded-xl"
                      style={{ maxHeight: '220px', objectFit: 'cover' }}
                      screenshotFormat="image/jpeg" />
                    <div className="absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-md"
                         style={{ background: 'rgba(10,15,30,0.8)', border: '1px solid rgba(239,68,68,0.5)' }}>
                      <span className="status-dot danger mr-1" />LIVE
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Motion.button onClick={captureFace} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd' }}>
                    📸 {capturedFace ? 'Retake' : 'Capture'}
                  </Motion.button>
                  {capturedFace && (
                    <Motion.button onClick={handleFaceRegister} disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-1">
                      {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '✅ Register Face'}
                    </Motion.button>
                  )}
                </div>

                <button onClick={skipFace} className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors py-1">
                  Skip for now (you can add face later)
                </button>
              </Motion.div>
            )}

            {/* ── STEP 2: Complete ── */}
            {step === 2 && (
              <Motion.div key="step2"
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                     style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)' }}>
                  <CheckCircleIcon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">Account Ready!</h3>
                <p className="text-gray-400 text-sm">
                  Welcome to Niriksha, {registeredUser?.user?.name}! 🎉
                </p>
                <div className="glass-card p-3 text-left space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-green-400">✓</span>
                    <span className="text-gray-300">Account created successfully</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={step >= 2 && faceEmbedding ? 'text-green-400' : 'text-gray-600'}>
                      {faceEmbedding ? '✓' : '–'}
                    </span>
                    <span className="text-gray-300">Face {faceEmbedding ? 'registered' : 'not registered (can add later)'}</span>
                  </div>
                </div>
                <Motion.button onClick={handleFinish} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="btn-primary w-full py-3">
                  {registeredUser?.user?.role === 'admin' ? 'Go to Dashboard →' : 'Start Face Verification →'}
                </Motion.button>
              </Motion.div>
            )}

          </AnimatePresence>
        </div>

        <div className="text-center mt-4">
          <span className="text-xs text-gray-500">Already have an account? </span>
          <Link to="/login" className="text-xs text-blue-400 hover:text-blue-300">Sign in</Link>
        </div>
      </Motion.div>
    </div>
  )
}
