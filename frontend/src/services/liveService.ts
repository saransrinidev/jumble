import { API_URL, STATIC, getHostPassword, query } from './api'
import type { Connection } from './realtimeService'

// Live gameplay snapshots are delivered by polling the backend's live endpoints.
// This replaces the previous WebSocket so the backend can run on serverless
// platforms (e.g. Vercel). The public contract is unchanged: callers still get
// onState(snapshot) and onStatus(connection) callbacks and a stop() function.
const POLL_INTERVAL_MS = 1500

export function subscribeLive(
  gameId: string,
  playerId: string | undefined,
  host: boolean,
  onState: (data: Record<string, unknown>) => void,
  onStatus: (state: Connection) => void,
) {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let announcedConnecting = false

  const path = `/api/${host ? 'host' : 'player'}/live` + query({ game_id: gameId, player_id: host ? undefined : playerId })

  const poll = async () => {
    if (stopped) return
    if (!announcedConnecting) {
      onStatus('connecting')
      announcedConnecting = true
    }
    try {
      const password = host && !STATIC ? getHostPassword() : ''
      if (stopped) return
      if (host && !STATIC && !password) {
        onStatus('unavailable')
        return
      }
      const response = STATIC
        ? await (await import('./mock/router')).handleMockRequest(path)
        : await fetch(`${API_URL}${path}`, {
            credentials: 'include',
            headers: password ? { Authorization: `Bearer ${password}` } : undefined,
          })
      if (stopped) return
      const body = await response.json().catch(() => null)
      if (response.ok && body?.success && body.data) {
        onStatus('connected')
        onState(body.data as Record<string, unknown>)
      } else {
        onStatus('reconnecting')
      }
    } catch {
      // Transient network error; keep polling. Reconnect restores the snapshot.
      if (!stopped) onStatus('reconnecting')
    } finally {
      if (!stopped) timer = setTimeout(() => void poll(), POLL_INTERVAL_MS)
    }
  }

  void poll()
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}
