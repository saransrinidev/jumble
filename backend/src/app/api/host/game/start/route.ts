import type { NextRequest } from 'next/server'
import { ok, handle } from '@/lib/envelope'
import { requireHost } from '@/lib/auth'
import { startGame } from '@/lib/engine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  return handle(async () => {
    requireHost(req)
    await startGame()
    return ok({ started: true })
  })
}
