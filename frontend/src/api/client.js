/**
 * Niriksha — Axios API Client
 * =============================
 * Centralized HTTP client that:
 *  - Points to backend at http://localhost:8000
 *  - Automatically attaches JWT from localStorage to every request
 *  - Handles 401 responses by redirecting to /login
 */
import axios from 'axios'

const API_BASE = 'http://localhost:8000'

// Create axios instance with default base URL
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000, // 30s timeout for AI operations
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: inject JWT ────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('niriksha_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Response interceptor: handle 401 globally ─────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear stale token and redirect to login
      localStorage.removeItem('niriksha_token')
      localStorage.removeItem('niriksha_user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

// ── Typed API helpers ─────────────────────────────────────────

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  me:       ()     => api.get('/auth/me'),
  registerFace: (userId, frameb64) =>
    api.post('/auth/register-face', { user_id: userId, frame_b64: frameb64 }),
  verifyFace: (userId, frameb64) =>
    api.post('/auth/verify-face', { user_id: userId, frame_b64: frameb64 }),
}

export const examAPI = {
  start:        (data) => api.post('/exam/start', data),
  submit:       (data) => api.post('/exam/submit', data),
  analyzeFrame: (data) => api.post('/exam/analyze_frame', data),
  getResult:    (sessionId) => api.get(`/exam/result/${sessionId}`),
  myResults:    () => api.get('/exam/my-results'),
}

export const dashboardAPI = {
  stats:    () => api.get('/dashboard/stats'),
  results:  (params) => api.get('/dashboard/results', { params }),
  student:  (userId) => api.get(`/dashboard/student/${userId}`),
  report:   (resultId) => api.get(`/dashboard/report/${resultId}`),
  events:   (sessionId) => api.get(`/dashboard/events/${sessionId}`),
  screenshotUrl: (userId, filename) => {
    const token = localStorage.getItem('niriksha_token')
    const baseUrl = `${API_BASE}/dashboard/screenshot/${userId}/${filename}`
    return token ? `${baseUrl}?token=${token}` : baseUrl
  },
}
