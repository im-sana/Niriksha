import { useEffect, useRef, useState } from 'react'

/**
 * useWebSocket
 *
 * Custom hook to maintain a WebSocket connection and return the latest message.
 *
 * @param {string} url - WebSocket URL (e.g. ws://localhost:8000/ws/exam/student_id)
 * @returns {string | null} latest raw message string from the server
 */
export default function useWebSocket(url) {
  const [lastMessage, setLastMessage] = useState(null)
  const wsRef  = useRef(null)
  const retryRef = useRef(null)

  useEffect(() => {
    let active = true

    const connect = () => {
      try {
        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
          console.log('[WS] Connected to', url)
          // Send handshake
          ws.send(JSON.stringify({ type: 'hello', client: 'exam_frontend' }))
        }

        ws.onmessage = (event) => {
          if (active) setLastMessage(event.data)
        }

        ws.onerror = (err) => {
          console.warn('[WS] Error:', err)
        }

        ws.onclose = () => {
          console.log('[WS] Disconnected. Retrying in 3s...')
          if (active) {
            retryRef.current = setTimeout(connect, 3000)
          }
        }
      } catch (err) {
        console.warn('[WS] Could not connect:', err)
        // Backend may not be running; silently degrade
      }
    }

    connect()

    return () => {
      active = false
      clearTimeout(retryRef.current)
      wsRef.current?.close()
    }
  }, [url])

  return lastMessage
}
