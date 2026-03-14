import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import Webcam from 'react-webcam'
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  UserCircleIcon,
  CheckCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import useBrowserMonitor from '../hooks/useBrowserMonitor'
import useWebSocket from '../hooks/useWebSocket'

// ──────────────────────────────────────────────
// Sample MCQ Questions
// ──────────────────────────────────────────────
const QUESTIONS = [
  {
    id: 1,
    question: 'Which data structure uses LIFO (Last In First Out) principle?',
    options: ['Queue', 'Stack', 'Linked List', 'Tree'],
    correct: 1,
  },
  {
    id: 2,
    question: 'What is the time complexity of binary search?',
    options: ['O(n)', 'O(n²)', 'O(log n)', 'O(n log n)'],
    correct: 2,
  },
  {
    id: 3,
    question: 'Which protocol is used for secure data transmission over the internet?',
    options: ['HTTP', 'FTP', 'HTTPS', 'SMTP'],
    correct: 2,
  },
  {
    id: 4,
    question: 'What does API stand for?',
    options: [
      'Application Programming Interface',
      'Application Process Integration',
      'Automated Protocol Interface',
      'Application Protocol Internet',
    ],
    correct: 0,
  },
  {
    id: 5,
    question: 'Which sorting algorithm has the best average-case time complexity?',
    options: ['Bubble Sort', 'Insertion Sort', 'Quick Sort', 'Selection Sort'],
    correct: 2,
  },
]

// ──────────────────────────────────────────────
// Cheating score rule weights
// ──────────────────────────────────────────────
const SCORE_RULES = {
  look_left:       2,
  look_right:      2,
  look_down:       3,
  face_missing:    5,
  phone_detected:  10,
  multiple_faces:  10,
  tab_switch:      10,
}

const CHEAT_THRESHOLD = 15

// ──────────────────────────────────────────────
// Utility: format seconds → MM:SS
// ──────────────────────────────────────────────
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function ExamPage() {
  const navigate = useNavigate()
  const webcamRef = useRef(null)

  // Exam state
  const [currentQ, setCurrentQ]     = useState(0)
  const [answers, setAnswers]       = useState({})
  const [timeLeft, setTimeLeft]     = useState(45 * 60) // 45 min
  const [examStarted, setExamStarted] = useState(false)
  const [submitted, setSubmitted]   = useState(false)

  // AI monitoring state
  const [cheatScore, setCheatScore]         = useState(0)
  const [behaviorLog, setBehaviorLog]       = useState([])
  const [faceStatus, setFaceStatus]         = useState('Initializing...')
  const [isFlagged, setIsFlagged]           = useState(false)
  const [cameraError, setCameraError]       = useState(false)
  const [webSocketStatus, setWsStatus]      = useState('connecting')

  // ── Hooks ──
  const wsEvents = useWebSocket('ws://localhost:8000/ws/exam/demo_student')

  // Browser monitor hook — reports events back via callback
  const addBehaviorEvent = useCallback((type, message) => {
    const weight = SCORE_RULES[type] ?? 2
    setCheatScore(prev => {
      const next = prev + weight
      if (next >= CHEAT_THRESHOLD && !isFlagged) {
        setIsFlagged(true)
        toast.error('⚠️ Cheating Flagged! Examiner has been alerted.', { duration: 6000 })
      }
      return next
    })
    const entry = { id: Date.now(), type, message, time: new Date().toLocaleTimeString() }
    setBehaviorLog(prev => [entry, ...prev].slice(0, 20))
    toast(`🚨 ${message}`, {
      duration: 3000,
      style: { border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(10,15,30,0.95)' },
    })
  }, [isFlagged])

  useBrowserMonitor(addBehaviorEvent)

  // ── Timer countdown ──
  useEffect(() => {
    if (!examStarted || submitted) return
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 0) { clearInterval(id); handleSubmit(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [examStarted, submitted])

  // ── Handle WebSocket events from backend ──
  useEffect(() => {
    if (!wsEvents) return
    try {
      const data = JSON.parse(wsEvents)
      if (data.event) {
        addBehaviorEvent(data.event, data.message || data.event)
        setFaceStatus(data.face_status || faceStatus)
        setWsStatus('connected')
      }
    } catch { /* raw message */ }
  }, [wsEvents])

  const handleSelect = (optIdx) => {
    setAnswers(prev => ({ ...prev, [currentQ]: optIdx }))
  }

  const handleNext = () => {
    if (currentQ < QUESTIONS.length - 1) setCurrentQ(c => c + 1)
  }

  const handlePrev = () => {
    if (currentQ > 0) setCurrentQ(c => c - 1)
  }

  const handleSubmit = () => {
    const correct = QUESTIONS.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0)
    setSubmitted(true)
    toast.success(`Exam submitted! Score: ${correct}/${QUESTIONS.length}`)
  }

  // ── Score ring color ──
  const scoreColor = cheatScore < 10 ? '#10b981' : cheatScore < 15 ? '#f59e0b' : '#ef4444'

  // ──────────────────── START SCREEN ────────────────────
  if (!examStarted) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'radial-gradient(ellipse at center, #0f172a 0%, #030712 100%)' }}
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-10 max-w-md w-full mx-6 text-center gradient-border"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
               style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            <AcademicCapIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Niriksha Exam</h1>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            By starting, you agree to AI monitoring of your webcam.<br />
            Ensure good lighting and keep your face visible at all times.
          </p>
          <div className="text-left space-y-3 mb-8">
            {[
              'Camera will be monitored throughout the exam',
              'Tab switching is not allowed',
              'No mobile phones permitted',
              'Duration: 45 minutes',
            ].map((rule, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-gray-300">
                <CheckCircleIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                {rule}
              </div>
            ))}
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setExamStarted(true)}
            className="btn-primary w-full py-4 text-base glow-blue"
          >
            Start Exam Session
          </motion.button>
          <button
            onClick={() => navigate('/')}
            className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Back to Home
          </button>
        </motion.div>
      </motion.div>
    )
  }

  // ──────────────────── SUBMIT SCREEN ────────────────────
  if (submitted) {
    const correct = QUESTIONS.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0)
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'radial-gradient(ellipse at center, #0f172a 0%, #030712 100%)' }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-card p-10 max-w-md w-full mx-6 text-center"
        >
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
               style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)' }}>
            <CheckCircleIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Exam Submitted!</h1>
          <p className="text-gray-400 mb-6">Your responses have been recorded.</p>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="glass-card p-4">
              <div className="text-3xl font-black text-green-400">{correct}/{QUESTIONS.length}</div>
              <div className="text-xs text-gray-400">Score</div>
            </div>
            <div className="glass-card p-4">
              <div className="text-3xl font-black" style={{ color: scoreColor }}>{cheatScore}</div>
              <div className="text-xs text-gray-400">Cheat Score</div>
            </div>
          </div>
          <div className={`badge text-sm py-2 px-4 mb-6 ${isFlagged ? 'badge-danger' : 'badge-safe'}`}>
            {isFlagged ? '⚠️ Flagged for Review' : '✅ No Violations Detected'}
          </div>
          <button onClick={() => navigate('/dashboard')} className="btn-primary w-full">
            View Dashboard Report
          </button>
        </motion.div>
      </motion.div>
    )
  }


  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col"
      style={{ background: '#030712' }}
    >
      {/* ── Top Bar ── */}
      <div className="glass-dark border-b border-white/05 px-6 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <ShieldCheckIcon className="w-5 h-5 text-blue-400" />
          <span className="font-bold text-sm text-blue-400">Niriksha</span>
          <span className="badge badge-info ml-2">LIVE</span>
        </div>

        {/* Exam Timer */}
        <div className="flex items-center gap-2">
          <ClockIcon className={`w-5 h-5 ${timeLeft < 300 ? 'text-red-400' : 'text-blue-400'}`} />
          <span className={`font-mono text-lg font-bold ${timeLeft < 300 ? 'text-red-400' : 'text-white'}`}>
            {formatTime(timeLeft)}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Cheat score indicator */}
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-400">Integrity:</div>
            <div className="w-24 h-2 rounded-full bg-dark-600 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: scoreColor, width: `${Math.min((cheatScore / 30) * 100, 100)}%` }}
                animate={{ width: `${Math.min((cheatScore / 30) * 100, 100)}%` }}
              />
            </div>
            <span className="text-xs font-mono" style={{ color: scoreColor }}>{cheatScore}</span>
          </div>

          {/* Student info */}
          <div className="flex items-center gap-2">
            <UserCircleIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-300">Student Demo</span>
          </div>

          {isFlagged && (
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="badge badge-danger"
            >
              ⚠ FLAGGED
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ──── LEFT PANEL: Camera + Status ──── */}
        <div className="w-80 flex flex-col gap-3 p-4 border-r border-white/05">

          {/* Webcam Feed */}
          <div className="relative rounded-xl overflow-hidden scan-line"
               style={{ border: isFlagged ? '2px solid rgba(239,68,68,0.6)' : '2px solid rgba(59,130,246,0.3)' }}>
            {cameraError ? (
              <div className="w-full h-48 flex items-center justify-center bg-dark-800 text-gray-500 text-xs">
                <div className="text-center">
                  <VideoCameraIcon className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                  Camera not available<br />(Backend mode)
                </div>
              </div>
            ) : (
              <Webcam
                ref={webcamRef}
                audio={false}
                className="w-full rounded-xl"
                style={{ height: '200px', objectFit: 'cover' }}
                onUserMediaError={() => setCameraError(true)}
              />
            )}

            {/* Face detection box overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-28 h-36 rounded-lg"
                   style={{ border: '2px solid rgba(59,130,246,0.7)', boxShadow: '0 0 20px rgba(59,130,246,0.3)' }}>
                {/* Corner markers */}
                {['top-left:0 0', 'top-right:0 auto', 'bottom-left:auto 0', 'bottom-right:auto auto'].map((pos) => (
                  <div key={pos} className="absolute w-3 h-3 border-blue-400"
                       style={{
                         top: pos.includes('top') ? -1 : 'auto',
                         bottom: pos.includes('bottom') ? -1 : 'auto',
                         left: pos.includes('left') ? -1 : 'auto',
                         right: pos.includes('right') ? -1 : 'auto',
                         borderTopWidth: pos.includes('top') ? 2 : 0,
                         borderLeftWidth: pos.includes('left') ? 2 : 0,
                         borderBottomWidth: pos.includes('bottom') ? 2 : 0,
                         borderRightWidth: pos.includes('right') ? 2 : 0,
                       }}
                  />
                ))}
              </div>
            </div>

            {/* LIVE badge */}
            <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold"
                 style={{ background: 'rgba(10,15,30,0.8)', border: '1px solid rgba(239,68,68,0.5)' }}>
              <span className="status-dot danger"></span>
              REC
            </div>
          </div>

          {/* Face Status */}
          <div className="glass-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Detection Status</span>
              <span className="status-dot active"></span>
            </div>
            <div className="text-sm font-medium text-blue-300">{faceStatus}</div>
          </div>

          {/* Cheat Score Card */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400">Integrity Score</span>
              {isFlagged && <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />}
            </div>
            <div className="flex items-center gap-3">
              {/* Score ring visualization */}
              <div className="relative w-14 h-14">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
                  <motion.circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke={scoreColor} strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.min((cheatScore / 30) * 100, 100)} 100`}
                    animate={{ strokeDasharray: `${Math.min((cheatScore / 30) * 100, 100)} 100` }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold" style={{ color: scoreColor }}>{cheatScore}</span>
                </div>
              </div>
              <div>
                <div className={`text-sm font-semibold ${isFlagged ? 'text-red-400' : cheatScore < 10 ? 'text-green-400' : 'text-yellow-400'}`}>
                  {isFlagged ? 'FLAGGED' : cheatScore < 10 ? 'Clean' : 'Warning'}
                </div>
                <div className="text-xs text-gray-500">Threshold: {CHEAT_THRESHOLD}</div>
              </div>
            </div>
          </div>

          {/* Behavior Log */}
          <div className="flex-1 glass-card p-3 overflow-hidden">
            <div className="text-xs text-gray-400 mb-2 font-semibold">Activity Log</div>
            <div className="space-y-1.5 overflow-y-auto max-h-48">
              <AnimatePresence>
                {behaviorLog.length === 0 ? (
                  <div className="text-xs text-gray-600 text-center py-4">No events detected</div>
                ) : (
                  behaviorLog.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/10"
                    >
                      <div className="text-xs text-red-400 mt-0.5">⚠</div>
                      <div>
                        <div className="text-xs text-gray-300">{log.message}</div>
                        <div className="text-xs text-gray-600">{log.time}</div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ──── RIGHT PANEL: MCQ Questions ──── */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">

          {/* Question progress */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm text-gray-400">
              Question <span className="text-white font-bold">{currentQ + 1}</span> of {QUESTIONS.length}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-dark-600 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}
                animate={{ width: `${((currentQ + 1) / QUESTIONS.length) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <div className="flex gap-1.5">
              {QUESTIONS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentQ(i)}
                  className="w-7 h-7 rounded-md text-xs font-bold transition-all"
                  style={{
                    background: i === currentQ
                      ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                      : answers[i] !== undefined
                        ? 'rgba(16,185,129,0.2)'
                        : 'rgba(255,255,255,0.05)',
                    border: i === currentQ ? 'none' : answers[i] !== undefined ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    color: answers[i] !== undefined || i === currentQ ? '#fff' : '#64748b',
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Question Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="glass-card p-8 mb-6 flex-1"
            >
              <h2 className="text-xl font-semibold text-white mb-8 leading-relaxed">
                <span className="text-blue-400 font-mono mr-3">Q{currentQ + 1}.</span>
                {QUESTIONS[currentQ].question}
              </h2>

              <div className="space-y-3">
                {QUESTIONS[currentQ].options.map((opt, i) => {
                  const selected = answers[currentQ] === i
                  return (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handleSelect(i)}
                      className="w-full text-left p-4 rounded-xl transition-all duration-200 flex items-center gap-4"
                      style={{
                        background: selected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                        border: selected ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.06)',
                        boxShadow: selected ? '0 0 20px rgba(59,130,246,0.2)' : 'none',
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                           style={{
                             background: selected ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'rgba(255,255,255,0.05)',
                             color: selected ? '#fff' : '#64748b',
                           }}>
                        {['A', 'B', 'C', 'D'][i]}
                      </div>
                      <span className={`text-sm ${selected ? 'text-white font-medium' : 'text-gray-300'}`}>{opt}</span>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-auto">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handlePrev}
              disabled={currentQ === 0}
              className="px-6 py-3 rounded-xl font-semibold text-sm transition-all glass border border-white/10 hover:border-blue-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Previous
            </motion.button>

            <div className="text-xs text-gray-500">
              {Object.keys(answers).length}/{QUESTIONS.length} answered
            </div>

            {currentQ === QUESTIONS.length - 1 ? (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmit}
                className="btn-primary px-8 py-3"
              >
                Submit Exam ✓
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleNext}
                className="btn-primary px-8 py-3"
              >
                Next →
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Fix missing import in JSX return
function AcademicCapIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  )
}

function VideoCameraIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
    </svg>
  )
}
