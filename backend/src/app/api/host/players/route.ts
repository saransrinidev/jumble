import type { NextRequest } from 'next/server'
import { ok, handle, AppError } from '@/lib/envelope'
import { requireHost } from '@/lib/auth'
import { addPlayer, listPlayers, removePlayer } from '@/lib/engine'
import { jsonBody, param } from '@/lib/http'

export const dynamic = 'force-dynamic'

// GET: list all roster players.
export async function GET(req: NextRequest) {
  return handle(async () => {
    requireHost(req)
    const players = await listPlayers()
    return ok(players.map((p) => ({ id: p._id, name: p.name, teamId: p.teamId, score: p.score, joined: p.joined })))
  })
}

// POST: add/upsert a player { userId, name, teamId }.
export async function POST(req: NextRequest) {
  return handle(async () => {
    requireHost(req)
    const body = await jsonBody<{ userId?: string; name?: string; teamId?: string }>(req)
    if (!body.userId || !body.teamId) throw new AppError('CONTENT_INVALID', 'userId and teamId are required.')
    const player = await addPlayer(body.userId, body.name ?? '', body.teamId)
    return ok({ id: player._id, name: player.name, teamId: player.teamId, score: player.score, joined: player.joined })
  })
}

// DELETE: remove a player by ?user_id=
export async function DELETE(req: NextRequest) {
  return handle(async () => {
    requireHost(req)
    const userId = param(req, 'user_id')
    if (!userId) throw new AppError('CONTENT_INVALID', 'user_id is required.')
    await removePlayer(userId)
    return ok({ ok: true })
  })
}
