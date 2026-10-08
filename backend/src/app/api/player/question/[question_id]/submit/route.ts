import type { NextRequest } from 'next/server'
import { ok, handle, AppError } from '@/lib/envelope'
import { submitAnswer } from '@/lib/engine'
import { param, jsonBody } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ question_id: string }> }) {
  return handle(async () => {
    const { question_id } = await ctx.params
    const playerId = param(req, 'player_id')
    if (!playerId) throw new AppError('UNAUTHORIZED', 'Missing player id.', 403)
    const body = await jsonBody<{ answer?: string; requestId?: string }>(req)
    return ok(await submitAnswer(playerId, question_id, (body.answer ?? '').toString(), (body.requestId ?? '').toString()))
  })
}
