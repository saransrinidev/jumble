import type { NextRequest } from 'next/server'
import { ok, handle } from '@/lib/envelope'
import { requireHost } from '@/lib/auth'
import { reviewAnswer } from '@/lib/engine'
import { jsonBody } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Host marks a player's answer correct or incorrect. Body: { correct: boolean } */
export async function POST(req: NextRequest, ctx: { params: Promise<{ submission_id: string }> }) {
  return handle(async () => {
    requireHost(req)
    const { submission_id } = await ctx.params
    const body = await jsonBody<{ correct?: boolean }>(req)
    await reviewAnswer(decodeURIComponent(submission_id), Boolean(body.correct))
    return ok({ ok: true })
  })
}
