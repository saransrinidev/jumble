/** CORS for the API: credentialed requests from the allowed origins. */
import { NextResponse, type NextRequest } from 'next/server'

export const config = { matcher: ['/api/:path*', '/health'] }

function allowed(): Set<string> {
  const origins = new Set<string>()
  origins.add(process.env.FRONTEND_URL ?? 'http://localhost:5173')
  if ((process.env.ENVIRONMENT ?? 'development') === 'development') {
    origins.add('http://localhost:5173')
    origins.add('http://localhost:4173')
  }
  return origins
}

function applyCors(res: NextResponse, origin: string) {
  res.headers.set('Access-Control-Allow-Origin', origin)
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  res.headers.set('Vary', 'Origin')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-host-password')
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin')
  const ok = origin !== null && allowed().has(origin)
  if (req.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 })
    if (ok) applyCors(res, origin!)
    return res
  }
  const res = NextResponse.next()
  if (ok) applyCors(res, origin!)
  return res
}
