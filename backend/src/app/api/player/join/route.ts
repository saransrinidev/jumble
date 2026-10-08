import type { NextRequest } from 'next/server'
import { ok, handle } from '@/lib/envelope'
import { joinByUserId, teamDisplayName } from '@/lib/engine'
import { jsonBody } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await jsonBody<{ name?: string; identifier?: string; employeeCode?: string }>(req)
    // The join form sends the user ID in `name` (or employeeCode).
    const userId = (body.employeeCode || body.identifier || body.name || '').toString()
    const { player, game } = await joinByUserId(userId)
    return ok({
      player: { id: player._id, name: player.name },
      team: { id: player.teamId, name: teamDisplayName(player.teamId) },
      game: { id: 'current', status: game.status },
    })
  })
}
