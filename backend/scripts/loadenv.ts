/**
 * Side-effect module: loads backend/.env into process.env on import.
 * Import this FIRST (before any module that reads env) in CLI scripts.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url)) // .../backend/scripts
const backendRoot = path.resolve(here, '..') // .../backend

for (const dir of [backendRoot, process.cwd()]) {
  for (const file of ['.env.local', '.env']) {
    try {
      const text = readFileSync(path.join(dir, file), 'utf8')
      for (const rawLine of text.split('\n')) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const eq = line.indexOf('=')
        if (eq === -1) continue
        const key = line.slice(0, eq).trim()
        let value = line.slice(eq + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        if (!(key in process.env)) process.env[key] = value
      }
    } catch {
      /* file optional */
    }
  }
}
