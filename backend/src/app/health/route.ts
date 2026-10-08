import { NextResponse } from 'next/server'
import { settings } from '@/lib/config'
import { db } from '@/lib/mongo'

export const dynamic = 'force-dynamic'

export async function GET() {
  let database = 'unchecked'
  try {
    await (await db()).command({ ping: 1 })
    database = 'ready'
  } catch {
    database = 'connection_failed'
  }
  return NextResponse.json({ status: 'healthy', environment: settings.ENVIRONMENT, database })
}
