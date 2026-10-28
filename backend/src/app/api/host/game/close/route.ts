import type { NextRequest } from 'next/server'
import { ok,handle } from '@/lib/envelope'
import { requireHost } from '@/lib/auth'
import { collection } from '@/lib/mongo'
import type { GameDoc } from '@/lib/types'
export const dynamic='force-dynamic'
// Soft-close only: retain the complete game record, questions, and scores.
export async function POST(req:NextRequest){return handle(async()=>{await requireHost(req);await (await collection<GameDoc>('game')).updateOne({_id:'current'},{$set:{closedAt:new Date(),status:'completed',phase:'completed'}});return ok({closed:true})})}
