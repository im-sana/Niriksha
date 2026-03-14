import { Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import LandingPage from './pages/LandingPage'
import ExamPage from './pages/ExamPage'
import DashboardPage from './pages/DashboardPage'
import AdminPage from './pages/AdminPage'

/**
 * Main application router.
 * AnimatePresence enables smooth page transitions.
 */
function App() {
  return (
    <AnimatePresence mode="wait">
      <Routes>
        <Route path="/"           element={<LandingPage />} />
        <Route path="/exam"       element={<ExamPage />} />
        <Route path="/dashboard"  element={<DashboardPage />} />
        <Route path="/admin"      element={<AdminPage />} />
      </Routes>
    </AnimatePresence>
  )
}

export default App
