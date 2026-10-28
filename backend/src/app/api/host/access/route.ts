import type { NextRequest } from 'next/server'
import { ok, handle } from '@/lib/envelope'
import { requireUser, dashboard } from '@/lib/dashboard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handle(async () => {
    return ok(await dashboard(await requireUser(req)))
  })
}
