import { useNavigate, } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

import {
  ShieldCheckIcon,
  HomeIcon,
  ChartBarIcon,
  AcademicCapIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'

const NAV_ITEMS = [
  { id: 'home',      label: 'Home',      icon: HomeIcon,             path: '/'          },
  { id: 'exam',      label: 'Exam',      icon: AcademicCapIcon,      path: '/exam'      },
  { id: 'dashboard', label: 'Dashboard', icon: ChartBarIcon,         path: '/dashboard' },
  { id: 'admin',     label: 'Admin',     icon: CogIcon,              path: '/admin'     },
]

/**
 * Sidebar navigation used by Dashboard and Admin pages.
 * Props:
 *   active: string — currently active nav item id
 */
export default function Sidebar({ active }) {
  const navigate = useNavigate()
  const { logout } = useAuthContext()

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
    navigate('/')
  }

  return (
    <aside className="w-16 md:w-60 flex flex-col border-r border-white/05 flex-shrink-0"
           style={{ background: 'rgba(10,15,30,0.6)', backdropFilter: 'blur(20px)' }}>
      
      {/* Logo */}
      <div className="p-4 border-b border-white/05">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            <ShieldCheckIcon className="w-5 h-5 text-white" />
          </div>
          <span className="hidden md:block text-sm font-bold gradient-text">Niriksha</span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id
          return (
            <motion.button
              key={item.id}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
              style={{
                background: isActive ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: isActive ? '#93c5fd' : '#64748b',
                border: isActive ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
              }}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="hidden md:block">{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="hidden md:block ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ background: '#3b82f6', boxShadow: '0 0 8px #3b82f6' }}
                />
              )}
            </motion.button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/05">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-300 hover:bg-white/03 transition-all"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
          <span className="hidden md:block">Exit</span>
        </button>
      </div>
    </aside>
  )
}
