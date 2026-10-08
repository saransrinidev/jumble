import type { NextRequest } from 'next/server'
import { ok, handle } from '@/lib/envelope'
import { requireHost } from '@/lib/auth'
import { createGame } from '@/lib/engine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  return handle(async () => {
    requireHost(req)
    await createGame()
    return ok({ id: 'current', title: 'Jumble', status: 'lobby' })
  })
}
