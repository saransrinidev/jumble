import { ok, handle, AppError } from '@/lib/envelope'
import { getGame } from '@/lib/engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    const game = await getGame()
    if (!game) throw new AppError('NO_ACTIVE_GAME', 'There is no active game.', 404)
    return ok({ id: 'current', title: 'Jumble', status: game.status })
  })
}
