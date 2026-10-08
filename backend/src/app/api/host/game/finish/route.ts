import type { NextRequest } from 'next/server'
import { ok, handle } from '@/lib/envelope'
import { requireHost } from '@/lib/auth'
import { finishGame } from '@/lib/engine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  return handle(async () => {
    requireHost(req)
    await finishGame()
    return ok({ ok: true })
  })
}
