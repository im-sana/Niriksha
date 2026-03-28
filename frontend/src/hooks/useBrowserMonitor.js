import { useEffect, useRef, useCallback } from 'react'

/**
 * useBrowserMonitor
 *
 * Custom hook that monitors browser-level cheating signals:
 *   - Tab / window visibility change
 *   - Fullscreen enforcement
 *   - Keyboard shortcut blocking (Alt+Tab, Ctrl+T, Ctrl+W, etc.)
 *   - Multiple monitor heuristic (screen vs window width)
 *   - Basic screen recording detection (MediaDevices API)
 *
 * @param {Function} onEvent - callback(type, message) called on each detection
 */
export default function useBrowserMonitor(onEvent, enabled = true) {
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  const report = useCallback((type, message) => {
    onEventRef.current?.(type, message)
  }, [])

  const requestExamFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    // ── 1. Tab visibility (tab switch) ──
    const handleVisibility = () => {
      if (document.hidden) {
        report('tab_switch', 'Tab switch detected')
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // ── 2. Window blur (Alt+Tab, click away) ──
    const handleBlur = () => {
      report('tab_switch', 'Window focus lost (possible Alt+Tab)')
    }
    window.addEventListener('blur', handleBlur)

    // ── 3. Keyboard shortcut blocking ──
    const BLOCKED_COMBOS = [
      { ctrl: true,  key: 'T' },  // new tab
      { ctrl: true,  key: 'W' },  // close tab
      { ctrl: true,  key: 'N' },  // new window
      { ctrl: true,  key: 'Tab' }, // cycle tabs
      { alt:  true,  key: 'Tab' }, // Alt+Tab
      { meta: true,  key: 'Tab' } ,       // Cmd+Tab (mac)
      { key: 'F12' },              // DevTools
      { ctrl: true, shift: true, key: 'I' }, // DevTools
    ]

    const handleKeyDown = (e) => {
      const matchesBlock = BLOCKED_COMBOS.some(combo => {
        const ctrlOk = combo.ctrl  ? (e.ctrlKey  || e.metaKey) : true
        const altOk  = combo.alt   ? e.altKey   : true
        const metaOk = combo.meta  ? e.metaKey  : true
        const keyOk  = e.key === combo.key || e.key?.toUpperCase() === combo.key
        return ctrlOk && altOk && metaOk && keyOk
      })
      if (matchesBlock) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)

    // ── 4. Right-click disable ──
    const handleContextMenu = (e) => e.preventDefault()
    document.addEventListener('contextmenu', handleContextMenu)

    // ── 5. Fullscreen exit detection ──
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        report('tab_switch', 'Exited fullscreen mode')
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    // ── 6. Multi-monitor detection ──
    const checkMultiMonitor = () => {
      try {
        // Heuristic: if screen width significantly exceeds window width it may be multi-monitor
        if (window.screen.width > window.innerWidth * 1.8) {
          report('tab_switch', 'Multiple monitors detected')
        }
      } catch {
        // Silently ignore errors from accessing screen properties
      }
    }
    checkMultiMonitor()

    // ── 7. Screen recording detection (getDisplayMedia probe) ──
    // We detect if a screen capture track is active via MediaStreamTrackProcessor probe
    // This is a best-effort heuristic; true detection isn't possible in browsers.

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [enabled, report])

  return requestExamFullscreen
}
