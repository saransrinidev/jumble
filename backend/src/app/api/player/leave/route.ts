import type { NextRequest } from 'next/server'
import { ok,handle } from '@/lib/envelope'
import { requireUser } from '@/lib/dashboard'
import { collection } from '@/lib/mongo'
import type { PlayerDoc } from '@/lib/types'
export const dynamic='force-dynamic'
export async function POST(req:NextRequest){return handle(async()=>{const user=await requireUser(req);await (await collection<PlayerDoc>('players')).updateOne({_id:user.id},{$set:{joined:false}});return ok({left:true})})}
