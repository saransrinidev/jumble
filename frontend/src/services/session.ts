export interface User { id: string; name: string }
export interface Session { token: string; user: User }
const key = 'jumble.session'
export function getSession(): Session | null { try { const s = JSON.parse(localStorage.getItem(key) || 'null'); return s?.token && s?.user?.id ? s : null } catch { return null } }
export function saveSession(session: Session) { localStorage.setItem(key, JSON.stringify(session)) }
export function logout() { for (const k of [key, 'jumble.player', 'jumble.game', 'jumble.visible-teams', 'jumble.host-password']) localStorage.removeItem(k) }
