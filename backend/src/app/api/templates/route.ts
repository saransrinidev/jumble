import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { ok, handle, AppError } from '@/lib/envelope'
import { requireUser, type Template } from '@/lib/dashboard'
import { collection } from '@/lib/mongo'
import { defaultRounds } from '@/lib/content'
import { jsonBody } from '@/lib/http'
import { roundsSchema } from '@/lib/templates'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) { return handle(async () => {
  const user = await requireUser(req)
  return ok({ templates: await (await collection<Template>('templates')).find({ ownerId: user.id }).sort({ updatedAt: -1 }).toArray(), defaults: defaultRounds() })
}) }
export async function POST(req: NextRequest) { return handle(async () => {
  const user = await requireUser(req)
  const body = await jsonBody<{ id?: string; title?: string; rounds?: unknown }>(req)
  const parsed = roundsSchema.safeParse(body.rounds)
  if (!parsed.success || !body.title?.trim() || body.title.length > 100) throw new AppError('CONTENT_INVALID', 'Enter a title and valid question content.', 422)
  const templates = await collection<Template>('templates')
  const template: Template = { _id: body.id || randomUUID(), ownerId: user.id, title: body.title.trim(), rounds: parsed.data, updatedAt: new Date() }
  if (body.id) {
    const result = await templates.replaceOne({ _id: body.id, ownerId: user.id }, template)
    if (!result.matchedCount) throw new AppError('CONTENT_INVALID', 'Saved game not found.', 404)
  } else await templates.insertOne(template)
  return ok(template)
}) }
