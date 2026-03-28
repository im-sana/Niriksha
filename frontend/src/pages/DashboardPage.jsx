/**
 * Niriksha — Advanced Teacher Dashboard
 * =======================================
 * Fetches REAL data from backend API (no more mock data).
 * Features:
 *   - Overview stats cards
 *   - Student result table with search, filter, sort
 *   - Claude AI report modal per student
 *   - Screenshot preview
 *   - Risk level filter chips
 */
import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence ,motion } from 'framer-motion' // eslint-disable-line no-unused-vars
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import {
  UsersIcon, ExclamationTriangleIcon, ShieldCheckIcon,
  ChartBarIcon, MagnifyingGlassIcon, XMarkIcon,
  ArrowUpIcon, ArrowDownIcon, DocumentTextIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'
import Sidebar from '../components/Sidebar'
import { useAuthContext } from '../context/AuthContext'
import { dashboardAPI } from '../api/client'

const RISK_COLORS = {
  Low:    { bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.3)',  text: '#10b981'  },
  Medium: { bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.3)',  text: '#f59e0b'  },
  High:   { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.3)',   text: '#ef4444'  },
}

function StatCard({ label, value, icon: Icon, color, delay = 0 }) { // eslint-disable-line no-unused-vars
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass-card p-5 hover:border-blue-500/20 transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="text-3xl font-black" style={{ color }}>{value ?? '—'}</div>
    </motion.div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthContext()

  // Data state
  const [stats,    setStats]    = useState(null)
  const [results,  setResults]  = useState([])
  const [total,    setTotal]    = useState(0)
  const [pages,    setPages]    = useState(1)
  const [loading,  setLoading]  = useState(true)

  // Filter/search/sort state
  const [search,    setSearch]    = useState('')
  const [riskFilter,setRiskFilter]= useState('')
  const [sortBy,    setSortBy]    = useState('timestamp')
  const [sortOrder, setSortOrder] = useState(-1)
  const [page,      setPage]      = useState(1)

  // Modal state
  const [selectedResult, setSelectedResult] = useState(null)
  const [report,         setReport]         = useState(null)
  const [reportLoading,  setReportLoading]  = useState(false)

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
    navigate('/')
  }

  // ── Fetch dashboard stats ──────────────────────────────────────
  useEffect(() => {
    dashboardAPI.stats().then(r => setStats(r.data)).catch(console.error)
  }, [])

  // ── Fetch results (re-runs on filter change) ───────────────────
  const fetchResults = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await dashboardAPI.results({
        search:     search || undefined,
        risk:       riskFilter || undefined,
        sort_by:    sortBy,
        sort_order: sortOrder,
        page,
        page_size:  15,
      })
      setResults(data.results)
      setTotal(data.total)
      setPages(data.pages)
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [search, riskFilter, sortBy, sortOrder, page])

  useEffect(() => { fetchResults() }, [fetchResults])

  // ── Toggle sort ───────────────────────────────────────────────
  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(o => o === -1 ? 1 : -1)
    else { setSortBy(field); setSortOrder(-1) }
  }

  // ── Open result modal + fetch Claude report ───────────────────
  const openReport = async (result) => {
    setSelectedResult(result)
    setReport(null)
    setReportLoading(true)
    try {
      const { data } = await dashboardAPI.report(result.id)
      setReport(data.report)
    } catch {
      setReport('Report generation failed. Please try again later.')
    } finally {
      setReportLoading(false)
    }
  }

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <span className="text-gray-600 ml-1">↕</span>
    return sortOrder === -1
      ? <ArrowDownIcon className="w-3 h-3 inline ml-1 text-blue-400" />
      : <ArrowUpIcon   className="w-3 h-3 inline ml-1 text-blue-400" />
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#030712' }}>
      <Sidebar active="dashboard" />

      <div className="flex-1 overflow-auto">
        {/* Top Bar */}
        <div className="glass-dark border-b border-white/05 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-white">Monitoring Dashboard</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Viewing as <span className="text-blue-400">{user?.name}</span> (Admin)
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="status-dot active" />
              <span className="text-gray-300">Live</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6">

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Students"  value={stats?.total_students}   icon={UsersIcon}              color="#3b82f6" delay={0}    />
            <StatCard label="Flagged"          value={stats?.flagged_count}    icon={ExclamationTriangleIcon} color="#ef4444" delay={0.06} />
            <StatCard label="Avg Risk Score"   value={stats?.avg_cheat_score}  icon={ChartBarIcon}           color="#f59e0b" delay={0.12} />
            <StatCard label="Total Exams"      value={stats?.total_exams}      icon={ShieldCheckIcon}        color="#10b981" delay={0.18} />
          </div>

          {/* Risk breakdown pills */}
          {stats && (
            <div className="flex gap-3 flex-wrap">
              <div className="glass-card px-4 py-2 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-gray-400">Low Risk:</span>
                <span className="text-green-400 font-bold">{stats.low_risk_count}</span>
              </div>
              <div className="glass-card px-4 py-2 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="text-gray-400">Medium Risk:</span>
                <span className="text-yellow-400 font-bold">{stats.medium_risk_count}</span>
              </div>
              <div className="glass-card px-4 py-2 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-gray-400">High Risk:</span>
                <span className="text-red-400 font-bold">{stats.high_risk_count}</span>
              </div>
            </div>
          )}

          {/* Search, Filter, Sort Controls */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-56">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="input-dark text-sm pl-9"
              />
            </div>

            {/* Risk filter chips */}
            <div className="flex gap-2">
              {['', 'Low', 'Medium', 'High'].map(r => (
                <button key={r}
                  onClick={() => { setRiskFilter(r); setPage(1) }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: riskFilter === r ? (RISK_COLORS[r]?.bg || 'rgba(59,130,246,0.15)') : 'rgba(255,255,255,0.03)',
                    border: riskFilter === r ? `1px solid ${RISK_COLORS[r]?.border || 'rgba(59,130,246,0.3)'}` : '1px solid rgba(255,255,255,0.06)',
                    color: riskFilter === r ? (RISK_COLORS[r]?.text || '#93c5fd') : '#64748b',
                  }}
                >
                  {r || 'All Risk'}
                </button>
              ))}
            </div>
          </div>

          {/* Results Table */}
          <div className="glass-card overflow-hidden">
            <div className="p-5 border-b border-white/05 flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <UsersIcon className="w-4 h-4 text-blue-400" />
                Student Results
                <span className="text-xs text-gray-500 font-normal">({total} total)</span>
              </h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <UsersIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No results found</p>
                {(search || riskFilter) && <p className="text-xs mt-1">Try clearing filters</p>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-white/05">
                      <th className="p-4 text-left">Student</th>
                      <th className="p-4 text-left cursor-pointer hover:text-gray-300 select-none" onClick={() => handleSort('exam_score')}>
                        Score <SortIcon field="exam_score" />
                      </th>
                      <th className="p-4 text-left cursor-pointer hover:text-gray-300 select-none" onClick={() => handleSort('cheat_score')}>
                        Risk Score <SortIcon field="cheat_score" />
                      </th>
                      <th className="p-4 text-left">Risk Level</th>
                      <th className="p-4 text-left cursor-pointer hover:text-gray-300 select-none" onClick={() => handleSort('timestamp')}>
                        Date <SortIcon field="timestamp" />
                      </th>
                      <th className="p-4 text-center">Screenshot</th>
                      <th className="p-4" />
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {results.map((result, i) => {
                        const rStyle = RISK_COLORS[result.risk_level] || RISK_COLORS.Low
                        return (
                          <motion.tr
                            key={result.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.03 }}
                            className="border-b border-white/03 hover:bg-white/02 transition-colors"
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                     style={{ background: `${rStyle.text}20`, color: rStyle.text }}>
                                  {(result.user_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <div>
                                  <div className="text-sm text-white font-medium">{result.user_name || 'Unknown'}</div>
                                  <div className="text-xs text-gray-500">{result.user_email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="text-sm font-mono font-bold text-white">
                                {result.exam_score}/{result.total_questions}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-white/05 overflow-hidden">
                                  <div className="h-full rounded-full" style={{
                                    background: rStyle.text,
                                    width: `${Math.min((result.cheat_score / 30) * 100, 100)}%`
                                  }} />
                                </div>
                                <span className="text-xs font-mono font-bold" style={{ color: rStyle.text }}>
                                  {result.cheat_score}
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="px-2 py-1 rounded-lg text-xs font-medium"
                                    style={{ background: rStyle.bg, border: `1px solid ${rStyle.border}`, color: rStyle.text }}>
                                {result.flagged ? '⚠ ' : ''}{result.risk_level}
                              </span>
                            </td>
                            <td className="p-4 text-xs text-gray-500">
                              {result.timestamp ? new Date(result.timestamp).toLocaleDateString('en-IN', {
                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                              }) : '—'}
                            </td>
                            <td className="p-4 text-center">
                              {result.screenshot_path ? (
                                <a
                                  href={dashboardAPI.screenshotUrl(result.user_id, result.screenshot_path.split('/').pop())}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300"
                                >📷 View</a>
                              ) : <span className="text-gray-700 text-xs">—</span>}
                            </td>
                            <td className="p-4">
                              <motion.button
                                onClick={() => openReport(result)}
                                whileHover={{ scale: 1.05 }}
                                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-all"
                                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#c4b5fd' }}
                              >
                                <DocumentTextIcon className="w-3 h-3" />
                                Report
                              </motion.button>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4 border-t border-white/05">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="px-3 py-1.5 text-xs rounded-lg glass border border-white/08 disabled:opacity-30">← Prev</button>
                <span className="text-xs text-gray-400">Page {page} of {pages}</span>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                        className="px-3 py-1.5 text-xs rounded-lg glass border border-white/08 disabled:opacity-30">Next →</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── AI Report Modal ── */}
      <AnimatePresence>
        {selectedResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={e => { if (e.target === e.currentTarget) setSelectedResult(null) }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
              style={{ border: '1px solid rgba(139,92,246,0.3)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-white">AI Report — {selectedResult.user_name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Score: {selectedResult.exam_score}/{selectedResult.total_questions} ·
                    Risk: {selectedResult.risk_level} ·
                    Cheat Score: {selectedResult.cheat_score}
                  </p>
                </div>
                <button onClick={() => setSelectedResult(null)} className="text-gray-500 hover:text-white transition-colors">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {reportLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">Claude is analyzing the session...</p>
                  </div>
                </div>
              ) : report ? (
                <div className="prose prose-invert prose-sm max-w-none" style={{ fontSize: '13px', lineHeight: '1.7' }}>
                  <ReactMarkdown>{report}</ReactMarkdown>
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
