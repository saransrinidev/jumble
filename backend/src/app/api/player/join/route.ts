import type { NextRequest } from 'next/server'
import { ok, handle } from '@/lib/envelope'
import { joinByUserId, teamDisplayName } from '@/lib/engine'
import { requireUser } from '@/lib/dashboard'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  return handle(async () => {
    // Joining always uses the logged-in identity, never a client-supplied ID.
    const userId = (await requireUser(req)).id
    const { player, game } = await joinByUserId(userId)
    return ok({
      player: { id: player._id, name: player.name },
      team: { id: player.teamId, name: teamDisplayName(player.teamId) },
      game: { id: 'current', status: game.status },
    })
  })
}
