import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  ShieldCheckIcon,
  UsersIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  BellIcon,
  CameraIcon,
  ArrowLeftIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import Sidebar from '../components/Sidebar'

// ── Mock data for demonstration ──
const MOCK_STUDENTS = [
  { id: 's1', name: 'Alice Johnson',   score: 8,  status: 'clean',   behaviors: ['Look Right x1'],      exam: 'CS101' },
  { id: 's2', name: 'Bob Smith',       score: 22, status: 'flagged', behaviors: ['Phone Detected', 'Tab Switch x2', 'Face Missing x3'], exam: 'CS101' },
  { id: 's3', name: 'Carol Williams',  score: 5,  status: 'clean',   behaviors: ['Look Left x1'],       exam: 'CS101' },
  { id: 's4', name: 'David Brown',     score: 17, status: 'flagged', behaviors: ['multiple_faces', 'Look Down x4'], exam: 'CS101' },
  { id: 's5', name: 'Emma Davis',      score: 3,  status: 'clean',   behaviors: [],                     exam: 'CS101' },
  { id: 's6', name: 'Frank Miller',    score: 31, status: 'flagged', behaviors: ['Phone x2', 'Tab Switch x3', 'Face Missing x5'], exam: 'CS101' },
]

const MOCK_CHART_DATA = [
  { time: '10:00', alice: 0,  bob: 0,  carol: 0,  david: 0  },
  { time: '10:05', alice: 2,  bob: 5,  carol: 0,  david: 2  },
  { time: '10:10', alice: 2,  bob: 10, carol: 3,  david: 5  },
  { time: '10:15', alice: 4,  bob: 15, carol: 3,  david: 10 },
  { time: '10:20', alice: 6,  bob: 22, carol: 5,  david: 17 },
  { time: '10:25', alice: 8,  bob: 25, carol: 5,  david: 17 },
]

const MOCK_ALERTS = [
  { id: 1, student: 'Bob Smith',    type: 'Phone Detected',    time: '10:14:23', severity: 'high' },
  { id: 2, student: 'David Brown',  type: 'Multiple Faces',    time: '10:11:07', severity: 'high' },
  { id: 3, student: 'Frank Miller', type: 'Tab Switch',        time: '10:09:55', severity: 'medium' },
  { id: 4, student: 'Bob Smith',    type: 'Tab Switch',        time: '10:08:33', severity: 'medium' },
  { id: 5, student: 'Frank Miller', type: 'Face Missing',      time: '10:07:12', severity: 'high' },
  { id: 6, student: 'Alice Johnson','type': 'Look Right',      time: '10:06:45', severity: 'low' },
]

const BEHAVIOR_TIMELINE_DATA = [
  { behavior: 'Eye Move', count: 18 },
  { behavior: 'Head Turn', count: 12 },
  { behavior: 'Tab Switch', count: 8 },
  { behavior: 'Face Missing', count: 6 },
  { behavior: 'Phone', count: 3 },
  { behavior: 'Multi Face', count: 2 },
]

const severityMap = {
  high:   { badge: 'badge-danger',  dot: 'danger' },
  medium: { badge: 'badge-warning', dot: 'warning' },
  low:    { badge: 'badge-info',    dot: 'active' },
}

const statusColor = (score) => score >= 15 ? '#ef4444' : score >= 8 ? '#f59e0b' : '#10b981'

// Custom tooltip for charts
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-dark p-3 rounded-xl border border-white/10 text-xs">
      <div className="text-gray-400 mb-2">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {p.value}</div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [alertCount, setAlertCount]           = useState(MOCK_ALERTS.length)
  const [liveAlerts, setLiveAlerts]           = useState(MOCK_ALERTS)
  const [activeStat, setActiveStat]           = useState('all')

  // Simulate real-time new alert
  useEffect(() => {
    const id = setInterval(() => {
      const names = ['Alice Johnson', 'Carol Williams', 'Emma Davis']
      const types = ['Look Left', 'Look Right', 'Head Turn']
      const newAlert = {
        id: Date.now(),
        student: names[Math.floor(Math.random() * names.length)],
        type: types[Math.floor(Math.random() * types.length)],
        time: new Date().toLocaleTimeString(),
        severity: 'low',
      }
      setLiveAlerts(prev => [newAlert, ...prev].slice(0, 10))
      setAlertCount(c => c + 1)
    }, 8000)
    return () => clearInterval(id)
  }, [])

  const stats = [
    { label: 'Total Students',  value: MOCK_STUDENTS.length,                                       icon: UsersIcon,              color: 'blue' },
    { label: 'Flagged',         value: MOCK_STUDENTS.filter(s => s.status === 'flagged').length,   icon: ExclamationTriangleIcon, color: 'red' },
    { label: 'Live Alerts',     value: alertCount,                                                  icon: BellIcon,               color: 'yellow' },
    { label: 'Avg Cheat Score', value: Math.round(MOCK_STUDENTS.reduce((a,s)=>a+s.score,0)/MOCK_STUDENTS.length), icon: ChartBarIcon, color: 'purple' },
  ]

  const colorVar = { blue: '#3b82f6', red: '#ef4444', yellow: '#f59e0b', purple: '#8b5cf6', green: '#10b981', cyan: '#06b6d4' }

  return (
    <div className="min-h-screen flex" style={{ background: '#030712' }}>
      <Sidebar active="dashboard" />

      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="glass-dark border-b border-white/05 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-white">Monitoring Dashboard</h1>
            <p className="text-xs text-gray-400 mt-0.5">CS101 Midterm Exam · Live Session</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="status-dot active"></span>
              <span className="text-gray-300">WebSocket Connected</span>
            </div>
            <span className="badge badge-danger">
              {MOCK_STUDENTS.filter(s=>s.status==='flagged').length} Flagged
            </span>
          </div>
        </div>

        <div className="p-8 space-y-6">

          {/* ── Stats Row ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="glass-card p-5 hover:border-blue-500/20 transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                       style={{ background: `${colorVar[stat.color]}20` }}>
                    <stat.icon className="w-5 h-5" style={{ color: colorVar[stat.color] }} />
                  </div>
                  <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{stat.label}</span>
                </div>
                <div className="text-3xl font-black" style={{ color: colorVar[stat.color] }}>{stat.value}</div>
              </motion.div>
            ))}
          </div>

          {/* ── Charts Row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cheating Score Timeline */}
            <div className="lg:col-span-2 glass-card p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <ChartBarIcon className="w-4 h-4 text-blue-400" />
                Cheating Score Timeline
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={MOCK_CHART_DATA}>
                  <defs>
                    {['bob','david','frank'].map((name, i) => (
                      <linearGradient key={name} id={`grad${name}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={['#ef4444','#8b5cf6','#f59e0b'][i]} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={['#ef4444','#8b5cf6','#f59e0b'][i]} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                  <Area type="monotone" dataKey="bob"   name="Bob"   stroke="#ef4444" fill="url(#gradbob)"   strokeWidth={2} />
                  <Area type="monotone" dataKey="david" name="David" stroke="#8b5cf6" fill="url(#graddavid)" strokeWidth={2} />
                  <Area type="monotone" dataKey="alice" name="Alice" stroke="#3b82f6" fill="none"             strokeWidth={1.5}/>
                  <Area type="monotone" dataKey="carol" name="Carol" stroke="#10b981" fill="none"             strokeWidth={1.5}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Behavior Bar Chart */}
            <div className="glass-card p-6">
              <h3 className="font-semibold text-white mb-4">Behavior Frequency</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={BEHAVIOR_TIMELINE_DATA} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis dataKey="behavior" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={72} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[0,4,4,0]}>
                    {BEHAVIOR_TIMELINE_DATA.map((_, i) => (
                      <rect key={i} fill={`hsl(${220 + i * 20},80%,60%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Student List + Alerts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Student Table */}
            <div className="lg:col-span-2 glass-card overflow-hidden">
              <div className="p-5 border-b border-white/05 flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-blue-400" />
                  Student Monitor
                </h3>
                <div className="flex gap-2">
                  {['all', 'flagged', 'clean'].map(f => (
                    <button key={f}
                      onClick={() => setActiveStat(f)}
                      className={`text-xs px-3 py-1 rounded-lg capitalize transition-all ${
                        activeStat === f
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-white/05">
                      <th className="p-4 text-left">Student</th>
                      <th className="p-4 text-left">Exam</th>
                      <th className="p-4 text-left">Score</th>
                      <th className="p-4 text-left">Status</th>
                      <th className="p-4 text-left">Behaviors</th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {MOCK_STUDENTS
                        .filter(s => activeStat === 'all' || s.status === activeStat)
                        .map((student, i) => (
                          <motion.tr
                            key={student.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.05 }}
                            className="border-b border-white/03 hover:bg-white/02 transition-colors cursor-pointer"
                            onClick={() => setSelectedStudent(selectedStudent?.id === student.id ? null : student)}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                                     style={{ background: `${statusColor(student.score)}20`, color: statusColor(student.score) }}>
                                  {student.name.split(' ').map(n=>n[0]).join('')}
                                </div>
                                <span className="text-sm text-white">{student.name}</span>
                              </div>
                            </td>
                            <td className="p-4 text-xs text-gray-400">{student.exam}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-dark-600 overflow-hidden">
                                  <div className="h-full rounded-full" style={{ background: statusColor(student.score), width: `${Math.min((student.score/30)*100,100)}%` }} />
                                </div>
                                <span className="text-xs font-mono font-bold" style={{ color: statusColor(student.score) }}>
                                  {student.score}
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`badge ${student.status === 'flagged' ? 'badge-danger' : 'badge-safe'}`}>
                                {student.status === 'flagged' ? '⚠ Flagged' : '✓ Clean'}
                              </span>
                            </td>
                            <td className="p-4 text-xs text-gray-400">{student.behaviors.length} events</td>
                            <td className="p-4">
                              <button className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Details</button>
                            </td>
                          </motion.tr>
                        ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* Expanded student detail */}
              <AnimatePresence>
                {selectedStudent && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-blue-500/20 p-5 bg-blue-500/05"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-blue-300 text-sm">{selectedStudent.name} — Detail</h4>
                      <button onClick={() => setSelectedStudent(null)}>
                        <XMarkIcon className="w-4 h-4 text-gray-400 hover:text-white" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="glass-card p-3 text-center">
                        <div className="text-2xl font-black" style={{ color: statusColor(selectedStudent.score) }}>{selectedStudent.score}</div>
                        <div className="text-xs text-gray-400">Cheat Score</div>
                      </div>
                      <div className="glass-card p-3 text-center">
                        <div className="text-2xl font-black text-white">{selectedStudent.behaviors.length}</div>
                        <div className="text-xs text-gray-400">Events</div>
                      </div>
                      <div className="glass-card p-3 text-center">
                        <span className={`badge text-sm ${selectedStudent.status === 'flagged' ? 'badge-danger' : 'badge-safe'}`}>
                          {selectedStudent.status}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {selectedStudent.behaviors.map((b, i) => (
                        <div key={i} className="text-xs text-gray-300 flex items-center gap-2">
                          <span className="text-red-400">⚠</span>{b}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Live Alerts Panel */}
            <div className="glass-card overflow-hidden">
              <div className="p-5 border-b border-white/05 flex items-center gap-2">
                <BellIcon className="w-4 h-4 text-yellow-400" />
                <h3 className="font-semibold text-white">Live Alerts</h3>
                <span className="ml-auto badge badge-danger">{liveAlerts.length}</span>
              </div>
              <div className="overflow-y-auto max-h-96 p-3 space-y-2">
                <AnimatePresence>
                  {liveAlerts.map((alert) => {
                    const s = severityMap[alert.severity]
                    return (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="p-3 rounded-xl border border-white/05 hover:border-white/10 transition-all"
                        style={{ background: 'rgba(255,255,255,0.02)' }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-white truncate">{alert.student}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{alert.type}</div>
                          </div>
                          <span className={`badge ${s.badge} flex-shrink-0`}>{alert.severity}</span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1.5 font-mono">{alert.time}</div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
