/**
 * Host authorization via a shared password (no external auth provider).
 * The frontend sends it as an `Authorization: Bearer <password>` header or an
 * `x-host-password` header. Verified against HOST_PASSWORD with a constant-time
 * comparison.
 */
import crypto from 'node:crypto'
import type { NextRequest } from 'next/server'
import { settings } from './config'
import { AppError } from './envelope'

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

export function requireHost(req: NextRequest): void {
  if (!settings.HOST_PASSWORD) {
    throw new AppError('UNAUTHORIZED_HOST', 'Host password is not configured on the server.', 403)
  }
  const provided = hostPasswordFrom(req)
  if (!provided || !constantTimeEqual(provided, settings.HOST_PASSWORD)) {
    throw new AppError('UNAUTHORIZED_HOST', 'Host authorization failed.', 403)
  }
}
