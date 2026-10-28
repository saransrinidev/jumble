import type { NextRequest } from 'next/server'
import { ok, handle } from '@/lib/envelope'
import { dashboard, requireUser } from '@/lib/dashboard'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) { return handle(async () => ok(await dashboard(await requireUser(req)))) }
