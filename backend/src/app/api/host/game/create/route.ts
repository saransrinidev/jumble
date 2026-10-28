import type { NextRequest } from 'next/server'
import { ok, handle } from '@/lib/envelope'
import { requireUser, type Template } from '@/lib/dashboard'
import { collection } from '@/lib/mongo'
import { jsonBody } from '@/lib/http'
import { AppError } from '@/lib/envelope'
import { createGame } from '@/lib/engine'
import type { GameDoc } from '@/lib/types'
import { validateRounds } from '@/lib/templates'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const body = await jsonBody<{ templateId?: string; replace?: boolean }>(req)
    const current = await (await collection<GameDoc>('game')).findOne({ _id: 'current' })
    if (current && current.status !== 'completed' && !body.replace) throw new AppError('GAME_BUSY', 'A game is already open. Confirm replacement first.', 409)
    const template = body.templateId ? await (await collection<Template>('templates')).findOne({ _id: body.templateId, ownerId: user.id }) : null
    if (body.templateId && !template) throw new AppError('CONTENT_INVALID', 'Saved game not found.', 404)
    if (template) validateRounds(template.rounds)
    const created = await createGame({ host: user, title: template?.title, rounds: template?.rounds })
    return ok({ id: 'current', title: created.title, status: 'lobby' })
  })
}
