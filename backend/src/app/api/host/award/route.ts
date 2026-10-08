import type { NextRequest } from 'next/server'
import { ok, handle, AppError } from '@/lib/envelope'
import { requireHost } from '@/lib/auth'
import { awardPoints, setScore } from '@/lib/engine'
import { jsonBody } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * Host manual scoring.
 * Body: { playerId, points }  -> add `points` (may be negative) to the player.
 *   or: { playerId, score }   -> set the player's absolute score.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    requireHost(req)
    const body = await jsonBody<{ playerId?: string; points?: number; score?: number }>(req)
    if (!body.playerId) throw new AppError('CONTENT_INVALID', 'playerId is required.')
    if (typeof body.score === 'number') await setScore(body.playerId, body.score)
    else if (typeof body.points === 'number') await awardPoints(body.playerId, body.points)
    else throw new AppError('CONTENT_INVALID', 'Provide points or score.')
    return ok({ ok: true })
  })
}
