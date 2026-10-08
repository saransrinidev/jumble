import type { NextRequest } from 'next/server'
import { ok, handle, AppError } from '@/lib/envelope'
import { requireHost } from '@/lib/auth'
import { saveQuestion } from '@/lib/engine'
import { jsonBody } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * Edit a question. Body: { questionId (or roundId), prompt?, acceptedAnswers?, points?, answerSeconds? }
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    requireHost(req)
    const body = await jsonBody<{
      questionId?: string
      roundId?: string
      prompt?: string
      acceptedAnswers?: string[]
      points?: number
      answerSeconds?: number
    }>(req)
    const target = body.questionId || body.roundId
    if (!target) throw new AppError('CONTENT_INVALID', 'questionId is required.')
    await saveQuestion(target, {
      prompt: body.prompt,
      acceptedAnswers: body.acceptedAnswers,
      points: body.points,
      answerSeconds: body.answerSeconds,
    })
    return ok({ ok: true })
  })
}
