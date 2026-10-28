/**
 * The current game's owner controls hosting through a verified user session.
 * Existing operational tools may still use the configured host password.
 */
import crypto from 'node:crypto'
import type { NextRequest } from 'next/server'
import { settings } from './config'
import { AppError } from './envelope'
import { requireUser } from './dashboard'
import { collection } from './mongo'
import type { GameDoc } from './types'

function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

export function hostPasswordFrom(req: NextRequest): string | null {
  const header = req.headers.get('authorization')
  if (header) {
    const match = /^Bearer\s+(.+)$/i.exec(header.trim())
    if (match) return match[1]
  }
  return req.headers.get('x-host-password')
}

export async function requireHost(req: NextRequest): Promise<void> {
  const provided = hostPasswordFrom(req)
  if (provided && settings.HOST_PASSWORD && constantTimeEqual(provided, settings.HOST_PASSWORD)) return
  const user = await requireUser(req)
  const game = await (await collection<GameDoc>('game')).findOne({ _id: 'current' })
  if (game?.host?.id === user.id) return
  throw new AppError('UNAUTHORIZED_HOST', 'Only the current host can control this game.', 403)
}
