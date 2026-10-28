import { z } from 'zod'
import { AppError } from './envelope'
export const roundsSchema = z.array(z.object({
  _id: z.string().min(1), index: z.number().int(), name: z.string().min(1).max(100), instructions: z.string().max(4000),
  kind: z.enum(['memory','emoji','drawing','mcq','text']).optional(),
  questions: z.array(z.object({
    _id: z.string().min(1), kind: z.enum(['memory', 'emoji', 'drawing', 'mcq', 'text']), prompt: z.string().max(4000),
    answerSeconds: z.number().min(1).max(300), points: z.number().min(0).max(1000), acceptedAnswers: z.array(z.string().max(4000)),
    words: z.array(z.string().max(100)).max(100).optional(), rows: z.number().int().min(1).max(10).optional(), cols: z.number().int().min(1).max(10).optional(), showSeconds: z.number().min(1).max(120).optional(),
    image: z.string().max(2000).optional(), rankPoints: z.array(z.number().min(0).max(1000)).optional(), options: z.array(z.string()).optional(), code: z.string().max(10000).optional(),
  })).max(100),
})).min(1).max(20)
export function validateRounds(input: unknown) {
  const parsed = roundsSchema.safeParse(input)
  if (!parsed.success) throw new AppError('CONTENT_INVALID', 'Check the round content, times, and scores.', 422)
  const rounds = parsed.data
  const ids = new Set<string>()
  for (const [i, round] of rounds.entries()) {
    if (round.index !== i || !round.questions.length) throw new AppError('CONTENT_INVALID', 'Every round needs at least one question.', 422)
    for (const q of round.questions) {
      if (ids.has(q._id)) throw new AppError('CONTENT_INVALID', 'Question IDs must be unique.', 422)
      ids.add(q._id)
      if (!q.prompt.trim() || (q.kind === 'memory' && (!q.words?.length || q.words.length !== (q.rows || 5) * (q.cols || 5))) || (q.kind !== 'memory' && !q.acceptedAnswers.some(a => a.trim())) || (q.kind === 'mcq' && (!q.options || q.options.length < 2 || !q.acceptedAnswers.every(a => q.options!.includes(a))))) throw new AppError('CONTENT_INVALID', 'Complete each question, its choices, and correct answers before hosting.', 422)
    }
  }
  return rounds
}
