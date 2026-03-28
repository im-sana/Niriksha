/**
 * Niriksha — Result Page
 * =======================
 * Shows persistent exam result fetched from database (not lost on page refresh).
 * Displays score, risk level, cheat score, and Claude AI behavior report.
 */
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import {
  CheckCircleIcon, ExclamationTriangleIcon,
  ChartBarIcon, ShieldCheckIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { useAuthContext } from '../context/AuthContext'
import { examAPI, dashboardAPI } from '../api/client'
import { motion } from 'framer-motion' // eslint-disable-line no-unused-vars

function RiskBadge({ level }) {
  const styles = {
    Low:    { bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.4)',  color: '#10b981',  icon: '✅' },
    Medium: { bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.4)',  color: '#f59e0b',  icon: '⚠️' },
    High:   { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)',   color: '#ef4444',  icon: '🚨' },
  }
  const s = styles[level] || styles.Low
  return (
    <span className="px-3 py-1.5 rounded-full text-sm font-semibold"
          style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      {s.icon} {level} Risk
    </span>
  )
}

export default function ResultPage() {
  const navigate   = useNavigate()
  const { user, isAdmin } = useAuthContext()
  const [params]   = useSearchParams()
  const sessionId  = params.get('session_id')
  const resultId   = params.get('result_id')

  const [result,  setResult]  = useState(null)
  const [report,  setReport]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [error,   setError]   = useState(null)

  // ── Fetch result from DB ──────────────────────────────────────
  useEffect(() => {
    const fetchResult = async () => {
      try {
        if (sessionId) {
          const { data } = await examAPI.getResult(sessionId)
          setResult(data)
        } else {
          setError('No session ID provided.')
        }
      } catch (err) {
        setError(err.response?.data?.detail || 'Could not load result. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchResult()
  }, [sessionId])

  // ── Fetch Claude report on demand ──────────────────────────────
  const loadReport = async () => {
    if (!result?.id && !resultId) return
    setReportLoading(true)
    try {
      const id = result?.id || resultId
      const { data } = await dashboardAPI.report(id)
      setReport(data.report)
    } catch {
      setReport('Report generation failed. Please try again later.')
    } finally {
      setReportLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-page-bg">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading your result...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center app-page-bg">
        <div className="glass-card p-8 text-center max-w-sm mx-4">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-2">Result Not Found</h2>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button onClick={() => navigate('/')} className="btn-primary px-6 py-2 text-sm">Go Home</button>
        </div>
      </div>
    )
  }

  const pct = result ? Math.round((result.exam_score / result.total_questions) * 100) : 0
  const scoreColor = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="min-h-screen py-8 px-4 app-page-bg">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
               style={{ background: result?.flagged ? 'rgba(239,68,68,0.2)' : 'linear-gradient(135deg, #10b981, #3b82f6)' }}>
            {result?.flagged
              ? <ExclamationTriangleIcon className="w-8 h-8 text-red-400" />
              : <CheckCircleIcon className="w-8 h-8 text-white" />}
          </div>
          <h1 className="text-3xl font-black text-white">Exam Complete!</h1>
          <p className="text-gray-400 mt-1 text-sm">
            {result?.user_name || user?.name} · {new Date(result?.timestamp).toLocaleString()}
          </p>
        </motion.div>

        {/* Scores Grid */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="grid grid-cols-3 gap-4 mb-6">
          <div className="glass-card p-4 text-center">
            <div className="text-3xl font-black mb-1" style={{ color: scoreColor }}>
              {result?.exam_score}/{result?.total_questions}
            </div>
            <div className="text-xs text-gray-400">Score ({pct}%)</div>
          </div>
          <div className="glass-card p-4 text-center">
            <div className="text-3xl font-black mb-1" style={{
              color: result?.cheat_score < 10 ? '#10b981' : result?.cheat_score < 20 ? '#f59e0b' : '#ef4444'
            }}>
              {result?.cheat_score}
            </div>
            <div className="text-xs text-gray-400">Integrity Score</div>
          </div>
          <div className="glass-card p-4 text-center flex flex-col items-center justify-center">
            <RiskBadge level={result?.risk_level || 'Low'} />
            <div className="text-xs text-gray-400 mt-2">Risk Level</div>
          </div>
        </motion.div>

        {/* Status banner */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                    className="glass-card p-4 mb-6 flex items-center gap-3"
                    style={{ border: result?.flagged ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(16,185,129,0.3)' }}>
          {result?.flagged
            ? <ExclamationTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
            : <ShieldCheckIcon className="w-5 h-5 text-green-400 flex-shrink-0" />}
          <div>
            <div className={`font-semibold text-sm ${result?.flagged ? 'text-red-400' : 'text-green-400'}`}>
              {result?.flagged ? '⚠️ Flagged for Review' : '✅ No Major Violations Detected'}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {result?.flagged
                ? 'Your exam has been flagged. An administrator will review your session.'
                : 'Your exam session passed integrity checks successfully.'}
            </div>
          </div>
        </motion.div>

        {/* Claude AI Report */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                    className="glass-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <DocumentTextIcon className="w-4 h-4 text-purple-400" />
              AI Behavior Report
            </h3>
            {!report && (
              <motion.button
                onClick={loadReport}
                disabled={reportLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}
              >
                {reportLoading ? (
                  <><div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" /> Generating...</>
                ) : '✨ Generate Report'}
              </motion.button>
            )}
          </div>

          {report ? (
            <div className="prose prose-invert prose-sm max-w-none text-gray-300"
                 style={{ fontSize: '13px', lineHeight: '1.7' }}>
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center py-4">
              Click "Generate Report" to get a detailed AI behavior analysis powered by Claude.
            </div>
          )}
        </motion.div>

        {/* Actions */}
        <div className="flex gap-3">
          <motion.button
            onClick={() => navigate('/')}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="flex-1 py-3 rounded-xl font-semibold text-sm"
            style={{ background: 'var(--surface-soft-bg)', border: '1px solid var(--surface-soft-border)', color: '#64748b' }}
          >
            ← Back Home
          </motion.button>
          {isAdmin && (
            <motion.button
              onClick={() => navigate('/dashboard')}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="flex-1 btn-primary py-3 text-sm"
            >
              View Dashboard →
            </motion.button>
          )}
        </div>

      </div>
    </div>
  )
}
