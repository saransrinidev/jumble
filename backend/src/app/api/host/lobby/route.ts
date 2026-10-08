import type { NextRequest } from 'next/server'
import { ok, handle } from '@/lib/envelope'
import { requireHost } from '@/lib/auth'
import { snapshot } from '@/lib/engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireHost(req)
    return ok(await snapshot({ host: true, playerId: null }))
  })
}
