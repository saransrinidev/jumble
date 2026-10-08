// Routes the frontend's /api/* calls to the in-browser engine and returns the
// same { success, data, error } envelope the real backend produced.
import * as engine from './engine'

type Envelope = { success: boolean; data: unknown; error: { code: string; message: string } | null }

interface MockError { __mock: true; code: string; message: string; status: number }
function isMockError(e: unknown): e is MockError {
  return typeof e === 'object' && e !== null && (e as MockError).__mock === true
}

function ok(data: unknown): Response {
  return json({ success: true, data, error: null }, 200)
}
function fail(code: string, message: string, status: number): Response {
  return json({ success: false, data: null, error: { code, message } } satisfies Envelope, status)
}
function json(body: Envelope, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function getParam(url: URL, name: string): string {
  return url.searchParams.get(name) ?? ''
}

async function parseBody(options: RequestInit): Promise<any> {
  if (!options.body) return {}
  if (typeof options.body === 'string') {
    try {
      return JSON.parse(options.body)
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * Handle a single mock request. Returns a Response mirroring the backend.
 * `path` includes the query string (e.g. /api/player/state?player_id=...).
 */
export async function handleMockRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const url = new URL(path, 'http://mock.local')
  const p = url.pathname
  const method = (options.method ?? 'GET').toUpperCase()

  try {
    // --- Host authorization probe (no Supabase in static mode) ---
    if (p === '/api/host/access') return ok({ role: 'host' })

    // --- Public game ---
    if (p === '/api/game/active' && method === 'GET') {
      const game = engine.activeGame()
      if (!game) return fail('NO_ACTIVE_GAME', 'There is no active game.', 404)
      return ok(game)
    }
    if (p === '/api/game/state' && method === 'GET') {
      return ok(engine.gameSnapshot(false, null))
    }

    // --- Player ---
    if (p === '/api/player/join' && method === 'POST') {
      const body = await parseBody(options)
      const name = (body.name ?? body.identifier ?? body.employeeCode ?? '').toString()
      return ok(engine.joinHuman(name || 'Player'))
    }
    if (p === '/api/player/state' && method === 'GET') {
      return ok(engine.playerState(getParam(url, 'player_id'), getParam(url, 'game_id')))
    }
    if (p === '/api/player/live' && method === 'GET') {
      return ok(engine.playerState(getParam(url, 'player_id'), getParam(url, 'game_id')))
    }
    const submitMatch = p.match(/^\/api\/player\/question\/([^/]+)\/submit$/)
    if (submitMatch && method === 'POST') {
      const body = await parseBody(options)
      return ok(
        engine.submit(getParam(url, 'player_id'), decodeURIComponent(submitMatch[1]), body.answer ?? '', body.requestId ?? ''),
      )
    }

    // --- Host live/lobby/status ---
    if (p === '/api/host/live' && method === 'GET') return ok(engine.gameSnapshot(true, null))
    if ((p === '/api/host/lobby' || p === '/api/host/status') && method === 'GET') {
      return ok(engine.gameSnapshot(true, null))
    }

    // --- Host game lifecycle ---
    if (p === '/api/host/game/create' && method === 'POST') return ok(engine.createGame())
    if (p === '/api/host/game/start' && method === 'POST') return ok(engine.startGame())
    if (p === '/api/host/game/next-question' && method === 'POST') return ok(engine.hostAction('next'))
    if (p === '/api/host/game/finish' && method === 'POST') return ok(engine.hostAction('finish'))
    if (p === '/api/host/game/replay' && method === 'POST') return ok(engine.replay())
    if (p === '/api/host/game/clue' && method === 'POST') return ok(engine.hostAction('clue'))

    const roundMatch = p.match(/^\/api\/host\/round\/([^/]+)\/(start|complete)$/)
    if (roundMatch && method === 'POST') {
      return ok(engine.hostAction(roundMatch[2] === 'start' ? 'round' : 'complete'))
    }

    const questionMatch = p.match(/^\/api\/host\/question\/([^/]+)\/(start|end|reveal-answer|reveal-score)$/)
    if (questionMatch && method === 'POST') {
      const map: Record<string, string> = { start: 'question', end: 'end', 'reveal-answer': 'answer', 'reveal-score': 'scores' }
      return ok(engine.hostAction(map[questionMatch[2]]))
    }

    const reviewMatch = p.match(/^\/api\/host\/game\/review\/([^/]+)$/)
    if (reviewMatch && method === 'POST') {
      const body = await parseBody(options)
      return ok(engine.review(decodeURIComponent(reviewMatch[1]), Boolean(body.correct)))
    }
    if (p === '/api/host/game/artist' && method === 'POST') {
      // Artist reassignment is a no-op in the simplified static drawing round.
      return ok({ ok: true })
    }

    // --- Host content authoring (uses the built-in bank) ---
    if (p === '/api/host/game/content' && method === 'GET') return ok(engine.gameContent())
    if (p === '/api/host/game/content' && method === 'PUT') {
      const body = await parseBody(options)
      return ok(engine.saveContent(body))
    }
    if (p === '/api/host/game/content/bank' && method === 'GET') return ok(engine.gameContent())
    if (p === '/api/host/game/content/validate' && method === 'GET') return ok(engine.validateContent())
    if (p.startsWith('/api/host/game/content/image')) {
      // No real storage in static mode.
      return fail('CONTENT_INVALID', 'Image upload is not available in the static demo.', 400)
    }

    return fail('ENDPOINT_UNAVAILABLE', 'This action is not available in the static demo.', 404)
  } catch (e) {
    if (isMockError(e)) return fail(e.code, e.message, e.status)
    return fail('INTERNAL_ERROR', 'The demo engine hit an unexpected error.', 500)
  }
}
