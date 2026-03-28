/**
 * Niriksha — Updated useWebSocket Hook
 * ======================================
 * Auto-reconnect with exponential backoff.
 * Prevents duplicate connections.
 * 
 * Features:
 *   - Exponential backoff: 1s → 2s → 4s → 8s → 16s → max 30s
 *   - Ping/pong keepalive every 25 seconds
 *   - Duplicate connection prevention
 *   - Sends browser events (tab switch, copy-paste) via WS
 */
import { useState, useEffect, useRef, useCallback } from 'react'

const MAX_BACKOFF_MS = 30000  // max 30 seconds between retries
const BASE_DELAY_MS  = 1000   // start at 1 second
const PING_INTERVAL  = 25000  // ping every 25 seconds

export default function useWebSocket(url) {
  const [lastMessage, setLastMessage]   = useState(null)
  const [wsStatus,    setWsStatus]      = useState('disconnected')
  const wsRef       = useRef(null)
  const retryCount  = useRef(0)
  const pingTimer   = useRef(null)
  const retryTimer  = useRef(null)
  const isMounted   = useRef(true)
  const sendRef     = useRef(null)  // stable reference to send function
  const connectRef  = useRef(null)  // stable reference to connect function

  const connect = useCallback(() => {
    // Prevent duplicate connections
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return
    }
    if (!url || !isMounted.current) return

    setWsStatus('connecting')

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (!isMounted.current) { ws.close(); return }
        retryCount.current = 0  // reset backoff on successful connection
        setWsStatus('connected')

        // Start keepalive pings
        clearInterval(pingTimer.current)
        pingTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, PING_INTERVAL)
      }

      ws.onmessage = (event) => {
        if (!isMounted.current) return
        setLastMessage(event.data)
      }

      ws.onerror = () => {
        // Error is always followed by onclose, handle there
      }

      ws.onclose = (event) => {
        if (!isMounted.current) return
        clearInterval(pingTimer.current)
        setWsStatus('disconnected')
        wsRef.current = null

        // Don't retry on intentional close (code 1000)
        if (event.code === 1000) return

        // Exponential backoff retry
        const delay = Math.min(BASE_DELAY_MS * (2 ** retryCount.current), MAX_BACKOFF_MS)
        retryCount.current += 1
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${retryCount.current})...`)
        
        retryTimer.current = setTimeout(() => {
          if (isMounted.current) connectRef.current()
        }, delay)
      }
    } catch (err) {
      console.error('[WS] Connection error:', err)
      setWsStatus('error')
    }
  }, [url])

  // ── Send function (stable across renders) ───────────────────
  const send = useCallback((data) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(typeof data === 'string' ? data : JSON.stringify(data))
      return true
    }
    return false
  }, [])

  // ── Connect on mount, disconnect on unmount ─────────────────
  useEffect(() => {
    isMounted.current = true
    connectRef.current = connect
    sendRef.current = send
    
    const timer = setTimeout(() => {
      if (isMounted.current) connect()
    }, 0)

    return () => {
      isMounted.current = false
      clearTimeout(timer)
      clearInterval(pingTimer.current)
      clearTimeout(retryTimer.current)
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted')
        wsRef.current = null
      }
    }
  }, [connect, send])

  return { lastMessage, wsStatus, send }
}
