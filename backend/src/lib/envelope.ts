/** Standard { success, data, error } envelope + error handling. */
import { NextResponse } from 'next/server'

export class AppError extends Error {
  readonly code: string
  readonly statusCode: number
  constructor(code: string, message: string, statusCode = 400) {
    super(message)
    this.code = code
    this.statusCode = statusCode
  }
}

export function ok<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data, error: null })
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { success: false, data: null, error: { code: error.code, message: error.message } },
      { status: error.statusCode },
    )
  }
  // Surface a missing-DB config clearly; otherwise generic.
  const message = error instanceof Error ? error.message : String(error)
  // Log the real cause server-side (never sent to the browser).
  console.error('[jumble] request failed:', message)
  if (/Mongo|querySrv|queryTxt|ETIMEOUT|ECONNREFUSED|ENOTFOUND|Server selection/i.test(message)) {
    return NextResponse.json(
      { success: false, data: null, error: { code: 'DATABASE_UNAVAILABLE', message: 'The game server could not reach the database. Retrying…' } },
      { status: 503 },
    )
  }
  if (message.includes('MONGODB_URI')) {
    return NextResponse.json(
      { success: false, data: null, error: { code: 'DATABASE_NOT_INITIALIZED', message } },
      { status: 503 },
    )
  }
  return NextResponse.json(
    { success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'The game server hit an unexpected error.' } },
    { status: 500 },
  )
}

/** Wrap an async handler so thrown errors become the standard envelope. */
export function handle(fn: () => Promise<NextResponse> | NextResponse): Promise<NextResponse> {
  return Promise.resolve().then(fn).catch(errorResponse)
}
