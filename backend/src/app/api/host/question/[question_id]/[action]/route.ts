import type { NextRequest } from 'next/server'
import { ok, handle, AppError } from '@/lib/envelope'
import { requireHost } from '@/lib/auth'
import { startQuestion, revealScores } from '@/lib/engine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ question_id: string; action: string }> }) {
  return handle(async () => {
    requireHost(req)
    const { action } = await ctx.params
    // start -> open the question; end/reveal-answer/reveal-score -> close + auto-score.
    if (action === 'start') await startQuestion()
    else if (['end', 'reveal-answer', 'reveal-score'].includes(action)) await revealScores()
    else throw new AppError('INVALID_ACTION', 'Unknown question action.')
    return ok({ ok: true })
  })
}
