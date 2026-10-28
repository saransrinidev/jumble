import type { NextRequest } from 'next/server'
import { ok, handle } from '@/lib/envelope'
import { login, requireUser } from '@/lib/dashboard'
import { jsonBody } from '@/lib/http'
export const dynamic = 'force-dynamic'
export async function POST(req: NextRequest) {
  return handle(async () => { const body = await jsonBody<{ identifier?: string }>(req); return ok(await login(String(body.identifier || ''))) })
}
export async function GET(req: NextRequest) { return handle(async () => ok(await requireUser(req))) }
