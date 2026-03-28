/**
 * Niriksha — Face Verification Page
 * ===================================
 * Pre-exam identity check. Captures live face and compares it
 * against the student's stored embedding.
 * On success → navigate to /exam
 */
import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence ,motion} from 'framer-motion'
import toast from 'react-hot-toast'
import Webcam from 'react-webcam'
import { ShieldCheckIcon, CameraIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { useAuthContext } from '../context/AuthContext'
import { authAPI } from '../api/client'

export default function FaceVerifyPage() {
  const navigate = useNavigate()
  const { user, updateFaceStatus } = useAuthContext()
  const webcamRef = useRef(null)

  const [status, setStatus] = useState('ready') // ready | verifying | success | failed | no_face
  const [confidence, setConfidence] = useState(0)
  const [message, setMessage] = useState('')
  const [attempts, setAttempts] = useState(0)
  const MAX_ATTEMPTS = 3
  const Motion = motion

  const registerCurrentFace = useCallback(async () => {
    if (!webcamRef.current || !user) return
    const screenshot = webcamRef.current.getScreenshot()
    if (!screenshot) {
      toast.error('Camera not available')
      return
    }

    try {
      const b64 = screenshot.split(',')[1]
      const { data } = await authAPI.registerFace(user.id, b64)
      updateFaceStatus(true)
      setStatus('ready')
      setMessage(data?.message || 'Face registered. Please verify now.')
      toast.success('Face registered. Verify again.')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Face registration failed. Please try again.'
      toast.error(msg)
    }
  }, [user, updateFaceStatus])

  const captureAndVerify = useCallback(async () => {
    if (!webcamRef.current || !user) return
    const screenshot = webcamRef.current.getScreenshot()
    if (!screenshot) { toast.error('Camera not available'); return }

    const b64 = screenshot.split(',')[1]
    setStatus('verifying')
    setAttempts(a => a + 1)

    try {
      const { data } = await authAPI.verifyFace(user.id, b64)
      setConfidence(data.confidence)
      setMessage(data.message)

      if (data.verified) {
        setStatus('success')
        toast.success('Identity verified! Starting exam...', { duration: 2000 })
        setTimeout(() => navigate('/exam'), 1500)
      } else {
        const noFace = String(data.message || '').toLowerCase().includes('no face registered')
        setStatus(noFace ? 'no_face' : 'failed')
        if (attempts + 1 >= MAX_ATTEMPTS) {
          toast.error('Too many failed attempts. Please contact your invigilator.')
        } else {
          if (noFace) {
            toast.error('No registered face found for this account.')
          } else {
            toast.error(`Verification failed. ${MAX_ATTEMPTS - attempts - 1} attempt(s) remaining.`)
          }
        }
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Verification error. Please try again.'
      setMessage(msg)
      setStatus('failed')
      toast.error(msg)
    }
  }, [user, navigate, attempts])

  const reset = () => {
    setStatus('ready')
    setConfidence(0)
    setMessage('')
  }

  const skipVerification = () => {
    toast('Skipping face verification — proceeding to exam.', { duration: 2000 })
    navigate('/exam')
  }

  const statusColor = status === 'success' ? '#10b981' : (status === 'failed' || status === 'no_face') ? '#ef4444' : '#3b82f6'

  return (
    <div className="min-h-screen flex items-center justify-center"
         style={{ background: 'radial-gradient(ellipse at 50% 0%, #0f172a 0%, #030712 70%)' }}>

      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm mx-4"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
               style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            <ShieldCheckIcon className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Identity Verification</h1>
          <p className="text-gray-400 text-sm mt-1">
            Hi <span className="text-blue-400">{user?.name}</span>, please verify your identity before the exam
          </p>
        </div>

        <div className="glass-card p-6" style={{ border: '1px solid rgba(59,130,246,0.15)' }}>
          {/* Webcam */}
          <div className="relative rounded-xl overflow-hidden mb-4"
               style={{ border: `2px solid ${statusColor}40` }}>
            <Webcam
              ref={webcamRef}
              audio={false}
              className="w-full rounded-xl"
              style={{ height: '240px', objectFit: 'cover' }}
              screenshotFormat="image/jpeg"
            />

            {/* Status overlay */}
            <AnimatePresence>
              {status !== 'ready' && (
                <Motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center rounded-xl"
                  style={{ background: `${statusColor}15` }}
                >
                  {status === 'verifying' && (
                    <div className="text-center">
                      <div className="w-10 h-10 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <div className="text-white text-sm font-semibold">Verifying identity...</div>
                    </div>
                  )}
                  {status === 'success' && (
                    <div className="text-center">
                      <CheckCircleIcon className="w-16 h-16 text-green-400 mx-auto" />
                      <div className="text-green-400 text-sm font-semibold mt-2">Verified!</div>
                    </div>
                  )}
                  {status === 'failed' && (
                    <div className="text-center">
                      <XMarkIcon className="w-16 h-16 text-red-400 mx-auto" />
                      <div className="text-red-400 text-sm font-semibold mt-2">Not matched</div>
                    </div>
                  )}
                  {status === 'no_face' && (
                    <div className="text-center">
                      <XMarkIcon className="w-16 h-16 text-red-400 mx-auto" />
                      <div className="text-red-400 text-sm font-semibold mt-2">No face registered</div>
                    </div>
                  )}
                </Motion.div>
              )}
            </AnimatePresence>

            {/* Live badge */}
            {status === 'ready' && (
              <div className="absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-md"
                   style={{ background: 'rgba(10,15,30,0.8)', border: '1px solid rgba(239,68,68,0.5)' }}>
                <span className="status-dot danger mr-1" />LIVE
              </div>
            )}
          </div>

          {/* Confidence bar (shown after attempt) */}
          {status !== 'ready' && status !== 'verifying' && (
            <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Match Confidence</span>
                <span style={{ color: statusColor }}>{Math.round(confidence * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/05 overflow-hidden">
                <Motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${confidence * 100}%` }}
                  className="h-full rounded-full"
                  style={{ background: statusColor }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              {message && <p className="text-xs mt-2" style={{ color: statusColor }}>{message}</p>}
            </Motion.div>
          )}

          {/* Attempts counter */}
          {attempts > 0 && (
            <div className="text-xs text-gray-500 text-center mb-3">
              Attempt {attempts} of {MAX_ATTEMPTS}
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2">
            {status === 'ready' && (
              <Motion.button
                onClick={captureAndVerify}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2"
              >
                <CameraIcon className="w-4 h-4" />
                Verify My Identity
              </Motion.button>
            )}

            {status === 'failed' && attempts < MAX_ATTEMPTS && (
              <Motion.button
                onClick={reset}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary w-full py-3"
              >
                Try Again
              </Motion.button>
            )}

            {status === 'no_face' && (
              <Motion.button
                onClick={registerCurrentFace}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary w-full py-3"
              >
                Register This Face Now
              </Motion.button>
            )}

            {/* Skip option (if no face registered) */}
            {status !== 'success' && (
              <button
                onClick={skipVerification}
                className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors py-2"
              >
                {user?.has_face_embedding ? 'Having trouble? Skip verification' : 'No face registered — Proceed without verification'}
              </button>
            )}
          </div>
        </div>

        {/* Tips */}
        <div className="mt-4 p-3 rounded-xl text-xs text-gray-500 space-y-1"
             style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="font-medium text-gray-400 mb-1">Tips for best results:</div>
          <div>• Ensure good lighting on your face</div>
          <div>• Look directly at the camera</div>
          <div>• Remove glasses if possible</div>
        </div>
      </Motion.div>
    </div>
  )
}
