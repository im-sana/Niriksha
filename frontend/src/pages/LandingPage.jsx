import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion' // eslint-disable-line no-unused-vars
import {
  ShieldCheckIcon,
  EyeIcon,
  CpuChipIcon,
  AcademicCapIcon,
  VideoCameraIcon,
  WifiIcon,
  ChartBarIcon,
  LockClosedIcon,
  ChevronDownIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'
import logo from '../assets/logo.svg'

// ---------- Animation Variants ----------
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: 'easeOut' },
  }),
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

// ---------- Feature Card Data ----------
const features = [
  {
    icon: EyeIcon,
    title: 'Eye Movement Tracking',
    description: 'Detects gaze direction — left, right, or down — using 468 MediaPipe Face Mesh landmarks.',
    color: 'blue',
  },
  {
    icon: CpuChipIcon,
    title: 'AI Object Detection',
    description: 'YOLOv8 real-time object detection identifies mobile phones and multiple persons in frame.',
    color: 'purple',
  },
  {
    icon: VideoCameraIcon,
    title: 'Head Pose Estimation',
    description: "OpenCV solvePnP algorithm tracks the student's head orientation across 6 DoF.",
    color: 'cyan',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Browser Integrity Guard',
    description: 'Enforces fullscreen, blocks keyboard shortcuts, detects tab switching and screen recording.',
    color: 'green',
  },
  {
    icon: WifiIcon,
    title: 'Real-Time Monitoring',
    description: 'WebSocket streams live cheating alerts and behavior logs to the teacher dashboard.',
    color: 'pink',
  },
  {
    icon: ChartBarIcon,
    title: 'Behavioral Analytics',
    description: 'Cheating probability score with historical trend charts and timeline visualization.',
    color: 'yellow',
  },
  {
    icon: LockClosedIcon,
    title: 'Secure Exam Session',
    description: 'MongoDB-backed session management stores evidence, snapshots, and audit trails.',
    color: 'red',
  },
  {
    icon: AcademicCapIcon,
    title: 'Hybrid Mode',
    description: 'Works for both online browser-based exams and offline classroom environments.',
    color: 'indigo',
  },
]

const colorMap = {
  blue:   { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   icon: 'text-blue-400',   glow: 'hover:shadow-blue-500/20' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', icon: 'text-purple-400', glow: 'hover:shadow-purple-500/20' },
  cyan:   { bg: 'bg-cyan-500/10',   border: 'border-cyan-500/30',   icon: 'text-cyan-400',   glow: 'hover:shadow-cyan-500/20' },
  green:  { bg: 'bg-green-500/10',  border: 'border-green-500/30',  icon: 'text-green-400',  glow: 'hover:shadow-green-500/20' },
  pink:   { bg: 'bg-pink-500/10',   border: 'border-pink-500/30',   icon: 'text-pink-400',   glow: 'hover:shadow-pink-500/20' },
  yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: 'text-yellow-400', glow: 'hover:shadow-yellow-500/20' },
  red:    { bg: 'bg-red-500/10',    border: 'border-red-500/30',    icon: 'text-red-400',    glow: 'hover:shadow-red-500/20' },
  indigo: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', icon: 'text-indigo-400', glow: 'hover:shadow-indigo-500/20' },
}

// ---------- Floating Orb ----------
function FloatingOrb({ className }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl opacity-20 pointer-events-none ${className}`}
      animate={{ y: [0, -30, 0], scale: [1, 1.05, 1] }}
      transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

// ---------- Stats Bar ----------
const stats = [
  { label: 'Detection Accuracy', value: '98.7%' },
  { label: 'Response Latency',   value: '<50ms' },
  { label: 'AI Models Active',   value: '8' },
  { label: 'Cheating Prevented', value: '10K+' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useAuthContext()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const dropdownRef = useRef(null)

  // const profilePath = user?.role === 'admin' ? '/dashboard' : '/face-verify'
  const avatarLabel = user?.name?.trim()?.charAt(0)?.toUpperCase() || 'U'

  useEffect(() => {
    const onMouseDown = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setIsProfileOpen(false)
      }
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
    setIsProfileOpen(false)
    navigate('/')
  }

  return (
    <motion.div
      className="min-h-screen relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      {/* ── Background mesh gradient ── */}
      <div className="fixed inset-0 z-0"
        style={{ background: 'var(--landing-bg)' }}
      />

      {/* ── Floating orbs ── */}
      <FloatingOrb className="w-96 h-96 bg-blue-500 top-20 -left-32" />
      <FloatingOrb className="w-64 h-64 bg-purple-500 top-40 right-10" />
      <FloatingOrb className="w-80 h-80 bg-cyan-500 bottom-20 left-1/3" />

      {/* ── Navbar ── */}
      <nav className="relative z-50 flex items-center justify-between px-8 py-5 glass-dark border-b border-white/5">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-3 transition-opacity hover:opacity-90"
          aria-label="Go to home"
        >
          {/* <div className="w-9 h-9 rounded-lg flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            <ShieldCheckIcon className="w-5 h-5 keep-white" />
          </div> */}
          <img src={logo} alt="Niriksha Logo" className="w-10 h-10 rounded-lg" />
          <span className="text-xl font-bold gradient-text">Niriksha</span>
        </button>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          <a href="#features" className="hover:text-blue-400 transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-blue-400 transition-colors">How It Works</a>
          <button onClick={() => navigate('/dashboard')} className="hover:text-blue-400 transition-colors">Dashboard</button>
        </div>
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsProfileOpen((open) => !open)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-white/10 hover:border-blue-500/40 transition-all"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold keep-white"
                     style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                  {avatarLabel}
                </div>
                <span className="hidden sm:block text-sm text-gray-200 max-w-28 truncate">{user?.name || 'User'}</span>
                <ChevronDownIcon className="w-4 h-4 text-gray-400" />
              </button>

              {isProfileOpen && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-2 w-52 glass-card border border-white/10 rounded-xl p-2 z-30 pointer-events-auto"
                >
                  <div className="px-3 py-2 border-b border-white/10 mb-1">
                    <p className="text-xs text-gray-500">Signed in as</p>
                    <p className="text-sm text-white font-medium truncate">{user?.name}</p>
                  </div>

                  {/* <button
                    onClick={handleProfileClick}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-white/5 transition-colors"
                  >
                    Profile
                  </button> */}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <ArrowRightOnRectangleIcon className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                Log In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="btn-primary text-sm px-5 py-2"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-28 pb-20">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-8"
          style={{
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.3)',
            color: '#93c5fd',
          }}
        >
          <span className="status-dot active"></span>
          AI-Powered · Real-Time · Multi-Modal Detection
        </motion.div>

        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="text-5xl md:text-7xl font-black tracking-tight mb-6 max-w-5xl leading-tight"
        >
          Intelligent Exam
          <br />
          <span className="gradient-text text-glow-blue">Monitoring</span>
          <span className="text-slate-900 dark:text-white"> Reimagined</span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={2}
          className="text-lg md:text-xl text-gray-400 max-w-2xl leading-relaxed mb-10"
        >
          Hybrid AI system detecting cheating in real-time using{' '}
          <span className="text-blue-400 font-semibold">computer vision</span>,{' '}
          <span className="text-purple-400 font-semibold">MediaPipe</span>, and{' '}
          <span className="text-cyan-400 font-semibold">YOLOv8</span> — for both online and offline exams.
        </motion.p>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={3}
          className="flex flex-col sm:flex-row gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/exam')}
            className="btn-primary text-base px-8 py-4 glow-blue"
          >
            🚀 Start Exam Session
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/dashboard')}
            className="px-8 py-4 rounded-xl font-semibold text-white transition-all duration-300 glass border border-white/10 hover:border-blue-500/50"
          >
            📊 View Dashboard
          </motion.button>
        </motion.div>

        {/* ── Tech logos / badges ── */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={4}
          className="flex flex-wrap justify-center gap-3 mt-12"
        >
          {['MediaPipe', 'YOLOv8', 'OpenCV', 'FastAPI', 'React', 'WebRTC', 'MongoDB', 'WebSocket'].map((tech) => (
            <span key={tech} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 glass border border-white/08">
              {tech}
            </span>
          ))}
        </motion.div>
      </section>

      {/* ── Stats bar ── */}
      <section className="relative z-10 mx-8 mb-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              variants={fadeUp}
              custom={i}
              className="glass-card p-6 text-center hover:border-blue-500/30 transition-all duration-300"
            >
              <div className="text-3xl font-black gradient-text mb-1">{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Features Grid ── */}
      <section id="features" className="relative z-10 px-8 pb-24">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-4xl font-bold mb-4">
            Every Angle.<br />
            <span className="gradient-text">Every Threat. Detected.</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            8 specialized AI detection modules working in parallel to ensure academic integrity.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-7xl mx-auto"
        >
          {features.map((feat, i) => {
            const c = colorMap[feat.color]
            return (
              <motion.div
                key={feat.title}
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -6, scale: 1.01 }}
                className={`glass-card p-6 border ${c.border} cursor-default
                           hover:shadow-xl ${c.glow} transition-all duration-300`}
              >
                <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center mb-4`}>
                  <feat.icon className={`w-6 h-6 ${c.icon}`} />
                </div>
                <h3 className="font-bold text-white mb-2 text-sm">{feat.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{feat.description}</p>
              </motion.div>
            )
          })}
        </motion.div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative z-10 px-8 pb-24">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-4xl font-bold mb-4">
            How <span className="gradient-text">Niriksha</span> Works
          </h2>
        </motion.div>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="flex flex-col md:flex-row gap-4 max-w-5xl mx-auto justify-center items-start"
        >
          {[
            { step: '01', title: 'Camera Access', desc: 'WebRTC captures live webcam stream directly in the browser.', color: 'blue' },
            { step: '02', title: 'AI Analysis', desc: 'Frame-by-frame analysis using MediaPipe + YOLOv8 running on the backend.', color: 'purple' },
            { step: '03', title: 'Score Update', desc: 'Rule-based engine increments cheating score per detected behavior.', color: 'cyan' },
            { step: '04', title: 'Live Alerts', desc: 'Teacher dashboard receives real-time alerts via WebSocket stream.', color: 'green' },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              variants={fadeUp}
              custom={i}
              className="flex-1 glass-card p-6 text-center relative"
            >
              <div className={`text-5xl font-black mb-3 opacity-30 ${colorMap[item.color].icon}`}>{item.step}</div>
              <h3 className="font-bold text-white mb-2">{item.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
              {i < 3 && (
                <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 text-gray-600 z-10">›</div>
              )}
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="relative z-10 px-8 pb-20">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="max-w-4xl mx-auto gradient-border p-12 text-center
          "
        >
          <h2 className="text-3xl font-bold mb-4   ">Ready to Secure Your Exams?</h2>
          <p className="text-gray-400 mb-8 ">
            Launch the monitored exam interface or explore the real-time monitoring dashboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/exam')}
              className="btn-primary px-10 py-4 text-base glow-blue"
            >
              Start Exam →
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/admin')}
              className="px-10 py-4 rounded-xl font-semibold text-white glass border border-white/10 hover:border-purple-500/50 transition-all duration-300"
            >
              Admin Panel
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/05 px-8 py-8 text-center text-gray-600 text-sm">
        <p>© 2025 Niriksha · Built with MediaPipe · YOLOv8 · FastAPI · React</p>
      </footer>
    </motion.div>
  )
}
