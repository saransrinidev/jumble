import type { NextConfig } from 'next'
import process from 'node:process'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  // Lets test scripts run a second dev server without touching your `.next`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // The native mongodb driver should stay external to the server bundle.
  serverExternalPackages: ['mongodb'],
}

export default nextConfig
