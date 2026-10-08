import type { NextRequest } from 'next/server'
import { ok, handle, AppError } from '@/lib/envelope'
import { clearCanvas, submitStroke } from '@/lib/engine'
import { param, jsonBody } from '@/lib/http'
import type { Stroke } from '@/lib/types'

export const dynamic = 'force-dynamic'

/** Draw & Guess: the artist adds a stroke, or `{ clear: true }` to wipe the canvas. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ question_id: string }> }) {
  return handle(async () => {
    const { question_id } = await ctx.params
    const playerId = param(req, 'player_id')
    if (!playerId) throw new AppError('UNAUTHORIZED', 'Missing player id.', 403)
    const body = await jsonBody<Stroke & { clear?: boolean }>(req)
    if (body.clear) return ok(await clearCanvas(playerId, question_id))
    return ok(await submitStroke(playerId, question_id, body))
  })
}
