import type { NextRequest } from 'next/server'
import { ok, handle } from '@/lib/envelope'
import { requireHost } from '@/lib/auth'
import { createGame, requireGame } from '@/lib/engine'

export const dynamic = 'force-dynamic'

/** Play Again: open a fresh lobby with the same roster and zeroed scores. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireHost(req)
    const game = await requireGame()
    await createGame(game.host ? { host: game.host, title: game.title, rounds: game.rounds } : undefined)
    return ok({ id: 'current', title: 'Jumble', status: 'lobby' })
  })
}
