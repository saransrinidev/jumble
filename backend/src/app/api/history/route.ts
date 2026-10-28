import type { NextRequest } from 'next/server'
import { ok,handle } from '@/lib/envelope'
import { requireUser,type Result } from '@/lib/dashboard'
import { collection } from '@/lib/mongo'
export const dynamic='force-dynamic'
export async function GET(req:NextRequest){return handle(async()=>{await requireUser(req);return ok(await (await collection<Result>('results')).find({}).sort({completedAt:-1}).limit(100).toArray())})}
