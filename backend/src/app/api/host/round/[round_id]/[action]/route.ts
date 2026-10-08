import type { NextRequest } from 'next/server'
import { ok, handle, AppError } from '@/lib/envelope'
import { requireHost } from '@/lib/auth'
import { nextQuestion, startRound } from '@/lib/engine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ round_id: string; action: string }> }) {
  return handle(async () => {
    requireHost(req)
    const { action } = await ctx.params
    // 'start' opens the round introduction; 'complete' moves on.
    if (action === 'start') await startRound()
    else if (action === 'complete') await nextQuestion()
    else throw new AppError('INVALID_ACTION', 'Unknown round action.')
    return ok({ ok: true })
  })
}
