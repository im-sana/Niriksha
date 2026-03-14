import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  UserPlusIcon,
  TrashIcon,
  PencilIcon,
  CogIcon,
} from '@heroicons/react/24/outline'
import Sidebar from '../components/Sidebar'

// ── Mock data ──
const INIT_STUDENTS = [
  { id: 'S001', name: 'Alice Johnson',  email: 'alice@uni.edu',  exam: 'CS101', enrolled: true },
  { id: 'S002', name: 'Bob Smith',      email: 'bob@uni.edu',    exam: 'CS101', enrolled: true },
  { id: 'S003', name: 'Carol Williams', email: 'carol@uni.edu',  exam: 'CS201', enrolled: true },
  { id: 'S004', name: 'David Brown',    email: 'david@uni.edu',  exam: 'CS101', enrolled: true },
]

const INIT_EXAMS = [
  { id: 'E001', title: 'CS101 Midterm',  subject: 'Data Structures', duration: 45, questions: 20, active: true },
  { id: 'E002', title: 'CS201 Final',    subject: 'Algorithms',      duration: 90, questions: 40, active: false },
  { id: 'E003', title: 'MATH101 Quiz',   subject: 'Calculus',        duration: 30, questions: 10, active: true },
]

function FormInput({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input-dark text-sm"
      />
    </div>
  )
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('exams')
  const [students, setStudents]   = useState(INIT_STUDENTS)
  const [exams, setExams]         = useState(INIT_EXAMS)
  const [showExamForm, setShowExamForm] = useState(false)
  const [showStudentForm, setShowStudentForm] = useState(false)

  // Exam form state
  const [examForm, setExamForm] = useState({ title: '', subject: '', duration: 45, questions: 20 })
  // Student form state
  const [studentForm, setStudentForm] = useState({ name: '', email: '', exam: 'CS101' })

  const handleAddExam = () => {
    if (!examForm.title || !examForm.subject) {
      toast.error('Please fill in all required fields')
      return
    }
    const newExam = {
      id: `E00${exams.length + 1}`,
      ...examForm,
      active: false,
    }
    setExams(prev => [newExam, ...prev])
    setExamForm({ title: '', subject: '', duration: 45, questions: 20 })
    setShowExamForm(false)
    toast.success('Exam created successfully!')
  }

  const handleAddStudent = () => {
    if (!studentForm.name || !studentForm.email) {
      toast.error('Please fill in all fields')
      return
    }
    const newStudent = {
      id: `S${String(students.length + 1).padStart(3, '0')}`,
      ...studentForm,
      enrolled: true,
    }
    setStudents(prev => [newStudent, ...prev])
    setStudentForm({ name: '', email: '', exam: 'CS101' })
    setShowStudentForm(false)
    toast.success('Student added successfully!')
  }

  const toggleExamActive = (id) => {
    setExams(prev => prev.map(e => e.id === id ? { ...e, active: !e.active } : e))
    toast.success('Exam status updated')
  }

  const deleteStudent = (id) => {
    setStudents(prev => prev.filter(s => s.id !== id))
    toast.success('Student removed')
  }

  const tabs = [
    { id: 'exams',    label: 'Exam Management',    icon: CogIcon },
    { id: 'students', label: 'Student Management', icon: UserPlusIcon },
    { id: 'settings', label: 'System Settings',    icon: CogIcon },
  ]

  return (
    <div className="min-h-screen flex" style={{ background: '#030712' }}>
      <Sidebar active="admin" />

      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="glass-dark border-b border-white/05 px-8 py-4">
          <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage exams, students, and system configuration</p>
        </div>

        <div className="p-8">
          {/* Tab Nav */}
          <div className="flex gap-1 p-1 rounded-xl mb-8"
               style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  background: activeTab === tab.id ? 'rgba(59,130,246,0.2)' : 'transparent',
                  color: activeTab === tab.id ? '#93c5fd' : '#64748b',
                  border: activeTab === tab.id ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                }}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ─── EXAM MANAGEMENT ─── */}
            {activeTab === 'exams' && (
              <motion.div key="exams" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold">Exams ({exams.length})</h2>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowExamForm(!showExamForm)}
                    className="btn-primary flex items-center gap-2 text-sm py-2.5"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Create Exam
                  </motion.button>
                </div>

                {/* Create exam form */}
                <AnimatePresence>
                  {showExamForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="glass-card p-6 mb-6 border border-blue-500/20"
                    >
                      <h3 className="font-semibold text-blue-300 mb-4 text-sm">New Exam</h3>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <FormInput label="Exam Title *" value={examForm.title}
                          onChange={e => setExamForm(p => ({...p, title: e.target.value}))}
                          placeholder="e.g. CS101 Midterm" />
                        <FormInput label="Subject *" value={examForm.subject}
                          onChange={e => setExamForm(p => ({...p, subject: e.target.value}))}
                          placeholder="e.g. Data Structures" />
                        <FormInput label="Duration (min)" type="number" value={examForm.duration}
                          onChange={e => setExamForm(p => ({...p, duration: Number(e.target.value)}))} />
                        <FormInput label="Number of Questions" type="number" value={examForm.questions}
                          onChange={e => setExamForm(p => ({...p, questions: Number(e.target.value)}))} />
                      </div>
                      <div className="flex gap-3">
                        <button onClick={handleAddExam} className="btn-primary text-sm py-2">Create Exam</button>
                        <button onClick={() => setShowExamForm(false)} className="text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Exam Cards */}
                <div className="space-y-3">
                  {exams.map((exam, i) => (
                    <motion.div
                      key={exam.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="glass-card p-5 flex items-center gap-4 hover:border-blue-500/20 transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-mono font-bold"
                           style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd' }}>
                        {exam.id}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-white text-sm">{exam.title}</div>
                        <div className="text-xs text-gray-400">{exam.subject} · {exam.duration}min · {exam.questions} questions</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`badge ${exam.active ? 'badge-safe' : 'bg-gray-500/20 text-gray-400'}`}>
                          {exam.active ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          onClick={() => toggleExamActive(exam.id)}
                          className="text-xs px-3 py-1.5 rounded-lg transition-all glass border border-white/08 hover:border-blue-500/30 text-gray-300 hover:text-blue-300"
                        >
                          {exam.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="p-2 rounded-lg glass border border-white/05 hover:border-blue-500/20 transition-all">
                          <PencilIcon className="w-3.5 h-3.5 text-gray-400 hover:text-blue-400" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ─── STUDENT MANAGEMENT ─── */}
            {activeTab === 'students' && (
              <motion.div key="students" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold">Students ({students.length})</h2>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowStudentForm(!showStudentForm)}
                    className="btn-primary flex items-center gap-2 text-sm py-2.5"
                  >
                    <UserPlusIcon className="w-4 h-4" />
                    Add Student
                  </motion.button>
                </div>

                <AnimatePresence>
                  {showStudentForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="glass-card p-6 mb-6 border border-purple-500/20"
                    >
                      <h3 className="font-semibold text-purple-300 mb-4 text-sm">New Student</h3>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <FormInput label="Full Name *" value={studentForm.name}
                          onChange={e => setStudentForm(p => ({...p, name: e.target.value}))}
                          placeholder="John Doe" />
                        <FormInput label="Email *" type="email" value={studentForm.email}
                          onChange={e => setStudentForm(p => ({...p, email: e.target.value}))}
                          placeholder="john@uni.edu" />
                        <div>
                          <label className="block text-xs text-gray-400 mb-1.5">Assign Exam</label>
                          <select
                            value={studentForm.exam}
                            onChange={e => setStudentForm(p => ({...p, exam: e.target.value}))}
                            className="input-dark text-sm"
                          >
                            {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={handleAddStudent} className="btn-primary text-sm py-2">Add Student</button>
                        <button onClick={() => setShowStudentForm(false)} className="text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="glass-card overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-white/05">
                        <th className="p-4 text-left">ID</th>
                        <th className="p-4 text-left">Student</th>
                        <th className="p-4 text-left">Email</th>
                        <th className="p-4 text-left">Exam</th>
                        <th className="p-4 text-left">Status</th>
                        <th className="p-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, i) => (
                        <motion.tr
                          key={student.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.04 }}
                          className="border-b border-white/03 hover:bg-white/02 transition-colors"
                        >
                          <td className="p-4 text-xs font-mono text-gray-500">{student.id}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-purple-500/20 text-purple-300">
                                {student.name.split(' ').map(n=>n[0]).join('')}
                              </div>
                              <span className="text-sm text-white">{student.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-xs text-gray-400">{student.email}</td>
                          <td className="p-4 text-xs text-gray-300">{student.exam}</td>
                          <td className="p-4">
                            <span className={`badge ${student.enrolled ? 'badge-safe' : 'badge-warning'}`}>
                              {student.enrolled ? 'Enrolled' : 'Pending'}
                            </span>
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => deleteStudent(student.id)}
                              className="p-2 rounded-lg hover:bg-red-500/10 transition-all group"
                            >
                              <TrashIcon className="w-4 h-4 text-gray-600 group-hover:text-red-400 transition-colors" />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* ─── SYSTEM SETTINGS ─── */}
            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* AI Detection Settings */}
                  <div className="glass-card p-6">
                    <h3 className="font-semibold text-white mb-5 flex items-center gap-2">
                      <CogIcon className="w-4 h-4 text-blue-400" />
                      AI Detection Settings
                    </h3>
                    {[
                      { label: 'Eye Movement Detection', key: 'eye', default: true },
                      { label: 'Head Pose Estimation',   key: 'head', default: true },
                      { label: 'Phone Detection (YOLO)', key: 'phone', default: true },
                      { label: 'Multiple Face Detection', key: 'multi', default: true },
                      { label: 'Hand Movement Tracking', key: 'hand', default: false },
                      { label: 'Talking Detection',      key: 'talk', default: true },
                    ].map(setting => (
                      <div key={setting.key} className="flex items-center justify-between py-3 border-b border-white/05 last:border-0">
                        <span className="text-sm text-gray-300">{setting.label}</span>
                        <ToggleSwitch defaultOn={setting.default} />
                      </div>
                    ))}
                  </div>

                  {/* Score Thresholds */}
                  <div className="glass-card p-6">
                    <h3 className="font-semibold text-white mb-5">Score Thresholds</h3>
                    {[
                      { label: 'Eye Look Left/Right', value: '+2' },
                      { label: 'Look Down',           value: '+3' },
                      { label: 'Face Missing',        value: '+5' },
                      { label: 'Phone Detected',      value: '+10' },
                      { label: 'Multiple Faces',      value: '+10' },
                      { label: 'Tab Switch',          value: '+10' },
                      { label: 'Flag Threshold',      value: '15',  special: true },
                    ].map(rule => (
                      <div key={rule.label} className="flex items-center justify-between py-3 border-b border-white/05 last:border-0">
                        <span className="text-sm text-gray-300">{rule.label}</span>
                        <span className={`font-mono text-sm font-bold px-3 py-1 rounded-lg ${rule.special ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/10 text-blue-300'}`}>
                          {rule.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Browser Monitor Settings */}
                  <div className="glass-card p-6">
                    <h3 className="font-semibold text-white mb-5">Browser Monitoring</h3>
                    {[
                      { label: 'Enforce Fullscreen',         default: true },
                      { label: 'Block Keyboard Shortcuts',   default: true },
                      { label: 'Tab Switch Detection',       default: true },
                      { label: 'Multi-Monitor Detection',    default: true },
                      { label: 'Screen Recording Detection', default: false },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between py-3 border-b border-white/05 last:border-0">
                        <span className="text-sm text-gray-300">{s.label}</span>
                        <ToggleSwitch defaultOn={s.default} />
                      </div>
                    ))}
                  </div>

                  {/* Database Status */}
                  <div className="glass-card p-6">
                    <h3 className="font-semibold text-white mb-5">System Status</h3>
                    {[
                      { label: 'MongoDB',     status: 'Connected',   color: 'green' },
                      { label: 'FastAPI',     status: 'Running',     color: 'green' },
                      { label: 'WebSocket',   status: 'Active',      color: 'green' },
                      { label: 'YOLOv8',     status: 'Model Loaded', color: 'blue' },
                      { label: 'MediaPipe',   status: 'Initialized', color: 'blue' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between py-3 border-b border-white/05 last:border-0">
                        <span className="text-sm text-gray-300">{item.label}</span>
                        <span className={`text-xs font-medium ${item.color === 'green' ? 'text-green-400' : 'text-blue-400'}`}>
                          <span className={`status-dot ${item.color === 'green' ? 'active' : 'warning'} mr-1.5`}></span>
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ── Toggle Switch Component ──
function ToggleSwitch({ defaultOn = false }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <button
      onClick={() => setOn(!on)}
      className="relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0"
      style={{ background: on ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.1)' }}
    >
      <motion.div
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md"
        animate={{ left: on ? '24px' : '4px' }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  )
}
