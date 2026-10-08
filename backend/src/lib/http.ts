import type { NextRequest } from 'next/server'
import { AppError } from './envelope'

export function param(req: NextRequest, name: string): string {
  return req.nextUrl.searchParams.get(name) ?? ''
}

export async function jsonBody<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    const text = await req.text()
    return (text ? JSON.parse(text) : {}) as T
  } catch {
    throw new AppError('CONTENT_INVALID', 'Request body must be valid JSON.')
  }
}
