/** Environment configuration (server-only). Read lazily so .env can load first. */
export const settings = {
  get MONGODB_URI() {
    return process.env.MONGODB_URI ?? ''
  },
  get MONGODB_DB() {
    return process.env.MONGODB_DB ?? 'jumble'
  },
  get HOST_PASSWORD() {
    return process.env.HOST_PASSWORD ?? ''
  },
  get FRONTEND_URL() {
    return process.env.FRONTEND_URL ?? 'http://localhost:5173'
  },
  get ENVIRONMENT() {
    return process.env.ENVIRONMENT ?? 'development'
  },
}

export function allowedOrigins(): Set<string> {
  const origins = new Set<string>([settings.FRONTEND_URL])
  if (settings.ENVIRONMENT === 'development') {
    origins.add('http://localhost:5173')
    origins.add('http://localhost:4173')
  }
  return origins
}
