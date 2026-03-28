import { Toaster } from 'react-hot-toast'
import { useTheme } from '../context/ThemeContext'

export default function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: isDark ? 'rgba(10, 15, 30, 0.9)' : 'rgba(255, 255, 255, 0.92)',
          color: isDark ? '#fff' : '#0f172a',
          border: isDark ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(15, 23, 42, 0.12)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          fontSize: '14px',
        },
        error: {
          style: { border: '1px solid rgba(239, 68, 68, 0.5)' },
          iconTheme: { primary: '#ef4444', secondary: '#fff' },
        },
        success: {
          style: { border: '1px solid rgba(16, 185, 129, 0.5)' },
          iconTheme: { primary: '#10b981', secondary: '#fff' },
        },
      }}
    />
  )
}
