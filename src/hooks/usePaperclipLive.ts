import { useEffect, useState } from 'react'

export interface LiveEvent {
  type: string
  companyId?: string
  payload?: Record<string, unknown>
  timestamp?: string
}

export function usePaperclipLive(
  companyId: string | undefined,
  onEvent?: (event: LiveEvent) => void
) {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!companyId || typeof WebSocket === 'undefined') return
    if (typeof window === 'undefined' || !window.location?.host) return

    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let closedByUser = false

    const connect = () => {
      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const url = `${proto}//${window.location.host}/api/companies/${encodeURIComponent(companyId)}/events/ws`
        ws = new WebSocket(url)

        ws.onopen = () => {
          setConnected(true)
        }

        ws.onmessage = (msg) => {
          try {
            const parsed = JSON.parse(msg.data)
            onEvent?.(parsed)
          } catch {
            // ignore non-json frames
          }
        }

        ws.onclose = () => {
          setConnected(false)
          if (!closedByUser) {
            reconnectTimer = setTimeout(connect, 5000)
          }
        }

        ws.onerror = () => {
          setConnected(false)
        }
      } catch {
        setConnected(false)
      }
    }

    connect()

    return () => {
      closedByUser = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      try {
        ws?.close()
      } catch {
        // ignore
      }
    }
  }, [companyId, onEvent])

  return { connected }
}
