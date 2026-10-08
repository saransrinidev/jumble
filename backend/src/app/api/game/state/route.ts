import { ok, handle } from '@/lib/envelope'
import { autoExpire, snapshot } from '@/lib/engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    await autoExpire()
    return ok(await snapshot({ host: false, playerId: null }))
  })
}
