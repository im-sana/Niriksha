/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const THEME_STORAGE_KEY = 'niriksha-theme'
const VALID_THEMES = new Set(['light', 'dark', 'system'])

const ThemeContext = createContext(null)

function getSystemTheme() {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialTheme() {
  if (typeof window === 'undefined') return 'system'
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  return VALID_THEMES.has(savedTheme) ? savedTheme : 'system'
}

function applyTheme(mode) {
  const root = document.documentElement
  const resolved = mode === 'system' ? getSystemTheme() : mode
  root.setAttribute('data-theme', resolved)
  root.classList.toggle('dark', resolved === 'dark')
  return resolved
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)
  const resolvedTheme = theme === 'system' ? systemTheme : theme

  useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const syncSystemTheme = () => {
      setSystemTheme(mediaQuery.matches ? 'dark' : 'light')
    }

    syncSystemTheme()
    mediaQuery.addEventListener('change', syncSystemTheme)
    return () => mediaQuery.removeEventListener('change', syncSystemTheme)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [resolvedTheme])

  const value = useMemo(() => ({
    theme,
    setTheme,
    resolvedTheme,
  }), [theme, resolvedTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
