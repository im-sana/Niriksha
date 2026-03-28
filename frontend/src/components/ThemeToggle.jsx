import { ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline'
import { useTheme } from '../context/ThemeContext'

const OPTIONS = [
  { id: 'light', label: 'Light', Icon: SunIcon },
  { id: 'dark', label: 'Dark', Icon: MoonIcon },
  { id: 'system', label: 'System', Icon: ComputerDesktopIcon },
]

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  return (
    <div className="theme-toggle-panel" role="group" aria-label="Theme switcher">
      {OPTIONS.map((option) => {
        const isActive = theme === option.id
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setTheme(option.id)}
            className={`theme-toggle-btn ${isActive ? 'is-active' : ''}`}
            aria-pressed={isActive}
            title={option.id === 'system' ? `System (${resolvedTheme})` : option.label}
          >
            <option.Icon className="w-4 h-4" />
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
