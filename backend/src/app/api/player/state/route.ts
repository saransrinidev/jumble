import type { NextRequest } from 'next/server'
import { ok, handle } from '@/lib/envelope'
import { autoExpire, requireRosterPlayer, snapshot, touchPlayer } from '@/lib/engine'
import { param } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handle(async () => {
    const playerId = param(req, 'player_id')
    await requireRosterPlayer(playerId)
    await touchPlayer(playerId)
    await autoExpire()
    return ok(await snapshot({ host: false, playerId }))
  })
}
