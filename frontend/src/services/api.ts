const messages: Record<string, string> = {
  NO_ACTIVE_GAME: 'The host hasn’t opened a game yet. Check back in a moment.',
  EMPLOYEE_NOT_FOUND: 'We couldn’t find that user ID. Enter the ID your host gave you.',
  DUPLICATE_EMPLOYEE_NAME: 'We found more than one person with that name. Enter your employee code.',
  EMPLOYEE_INACTIVE: 'Your player profile is inactive. Please check with the host.',
  GAME_ALREADY_STARTED: 'A game is already underway. Ask the host about joining.',
  ANSWER_ALREADY_SUBMITTED: 'Your answer is already locked. You’re all set!',
  QUESTION_NOT_ACTIVE: 'This question has closed. Waiting for the host’s next move.',
  UNAUTHORIZED_HOST: 'This account does not have permission to access the control area.',
  UNAUTHORIZED: 'Your session has expired. Enter your name again to rejoin.',
  ROUND_CONTENT_REQUIRED: 'Round content is not configured yet. The lobby remains open.',
  NETWORK_ERROR: `We couldn’t reach the game server at ${(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')}. Make sure the backend is running, then try again.`,
  SERVER_ERROR: 'The game server hit a snag. Please try again.',
  ENDPOINT_UNAVAILABLE: 'This action isn’t available on the connected backend yet.',
  DATABASE_NOT_INITIALIZED: 'The host needs to finish setting up the game database. Please check back soon.',
}
export class ApiError extends Error {
  constructor(public code: string, detail?: string) { super(detail ?? messages[code] ?? messages.SERVER_ERROR) }
}
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
export const DEMO = import.meta.env.VITE_DEMO === 'true'
// STATIC mode: no backend. All /api calls are served by an in-browser mock
// engine so the game is fully playable as a static site. Enabled by default
// unless an explicit API URL is provided, or forced via VITE_STATIC.
export const STATIC =
  import.meta.env.VITE_STATIC === 'true' ||
  (import.meta.env.VITE_STATIC !== 'false' && !import.meta.env.VITE_API_URL)
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12000)
  try {
    const response = STATIC
      ? await (await import('./mock/router')).handleMockRequest(path, options)
      : await fetch(`${API_URL}${path}`, { ...options, credentials: 'include', signal: controller.signal, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(path.startsWith('/api/host/') ? await hostAuthHeader() : {}), ...options.headers } })
    const body = await response.json().catch(() => null)
    if (!response.ok || body?.success === false) {
      throw new ApiError(body?.error?.code || body?.detail?.code || (response.status === 404 ? 'ENDPOINT_UNAVAILABLE' : 'SERVER_ERROR'), body?.error?.message || (response.status === 422 ? 'Some fields are invalid. Check the question content and try again.' : undefined))
    }
    return (body?.data ?? body) as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('NETWORK_ERROR')
  } finally { window.clearTimeout(timeout) }
}
// Host auth uses a shared password the host enters at /control. We send it as a
// Bearer token to the backend's requireHost check and keep it in localStorage.
const HOST_PASSWORD_KEY = 'jumble.host-password'
export function setHostPassword(password: string) { localStorage.setItem(HOST_PASSWORD_KEY, password) }
export function getHostPassword(): string { return localStorage.getItem(HOST_PASSWORD_KEY) || '' }
export function clearHostPassword() { localStorage.removeItem(HOST_PASSWORD_KEY) }
async function hostAuthHeader(): Promise<Record<string, string>> {
  const password = getHostPassword()
  return password ? { Authorization: `Bearer ${password}` } : {}
}
export const post = <T>(path: string, body: unknown = {}) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })
export function query(params: Record<string, string | undefined>) {
  return '?' + new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined)).toString()
}
