// HTTP end-to-end check: starts `next dev`, then plays the host/player flow
// over real HTTP (CORS preflight + host password), timing every request.
// Usage (from anywhere): node backend/scripts/http-e2e.mjs
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  readFileSync(path.join(root, '.env'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
)
const PORT = 8010
const BASE = `http://localhost:${PORT}`
const ORIGIN = 'http://localhost:5173'
const HOST = { Authorization: `Bearer ${env.HOST_PASSWORD}` }
const out = []
const log = (s) => { out.push(s); console.log(s) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '-p', String(PORT)], { cwd: root, env: { ...process.env, NEXT_DIST_DIR: '.next-e2e' } })
const serverLog = []
server.stdout.on('data', (d) => serverLog.push(String(d)))
server.stderr.on('data', (d) => serverLog.push(String(d)))

async function call(method, p, { body, host = false, preflight = false } = {}) {
  const headers = { Origin: ORIGIN, ...(host ? HOST : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }
  if (preflight) {
    const t0 = Date.now()
    try {
      const r = await fetch(BASE + p, { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': 'authorization,content-type' } })
      log(`  OPTIONS ${p} -> ${r.status} ${Date.now() - t0}ms ACAO=${r.headers.get('access-control-allow-origin')}`)
    } catch (e) { log(`  OPTIONS ${p} -> NETWORK FAIL ${Date.now() - t0}ms ${e.message}`) }
  }
  const t0 = Date.now()
  try {
    const r = await fetch(BASE + p, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) })
    const ms = Date.now() - t0
    const text = await r.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* not json */ }
    const flag = ms > 12000 ? '  <<< SLOWER THAN THE 12s FRONTEND TIMEOUT' : ''
    log(`${method} ${p} -> ${r.status} ${ms}ms ACAO=${r.headers.get('access-control-allow-origin')} ${json ? (json.success ? 'ok' : JSON.stringify(json.error)) : 'NON-JSON: ' + text.slice(0, 120)}${flag}`)
    return json?.data
  } catch (e) {
    log(`${method} ${p} -> NETWORK FAIL after ${Date.now() - t0}ms: ${e.message}`)
    return null
  }
}

try {
  // wait for the dev server
  for (let i = 0; i < 90; i++) { try { await fetch(BASE + '/health'); break } catch { await sleep(1000) } }
  log('--- server up ---')
  await call('GET', '/health')
  await call('POST', '/api/host/game/create', { host: true, body: {}, preflight: true })
  await call('POST', '/api/player/join', { body: { name: 'GIPL042' }, preflight: true })
  await call('POST', '/api/player/join', { body: { name: 'GIPL001' } })
  await call('POST', '/api/host/game/start', { host: true, body: {}, preflight: true })
  let s = await call('GET', '/api/host/status', { host: true })
  log(`  phase=${s?.phase} round=${s?.round} q=${s?.question?.id}`)

  // Question 1: full play
  await call('POST', `/api/host/question/r1q1/start`, { host: true, body: {}, preflight: true })
  await sleep(5500)
  await call('POST', `/api/player/question/r1q1/submit?player_id=GIPL042&game_id=current`, { body: { answer: 'APPLE\nCHAIR\nRIVER', requestId: 'x1' }, preflight: true })
  await call('GET', `/api/player/live?game_id=current&player_id=GIPL042`)
  await call('POST', `/api/host/question/r1q1/end`, { host: true, body: {}, preflight: true })
  s = await call('GET', '/api/host/status', { host: true })
  log(`  after close: phase=${s?.phase} scores=${s?.teams?.map((t) => `${t.name}=${t.score}(+${t.roundGain})`).join(', ')}`)
  const p = await call('GET', `/api/player/state?player_id=GIPL042&game_id=current`)
  log(`  player view: score=${p?.player?.score} recalled=${p?.player?.recallCorrect} earned=${p?.player?.earnedPoints}`)

  // The reported failing click
  log('--- clicking Next ---')
  await call('POST', '/api/host/game/next-question', { host: true, body: {}, preflight: true })
  s = await call('GET', '/api/host/status', { host: true })
  log(`  phase=${s?.phase} round=${s?.round} q=${s?.question?.number}/${s?.question?.scoredCount}`)

  // Rest of round 1 -> between -> round 2
  for (let q = 2; q <= 6; q++) {
    await call('POST', `/api/host/question/r1q${q}/start`, { host: true, body: {} })
    await call('POST', `/api/host/question/r1q${q}/end`, { host: true, body: {} })
    await call('POST', '/api/host/game/next-question', { host: true, body: {} })
  }
  s = await call('GET', '/api/host/status', { host: true })
  log(`  phase=${s?.phase} round=${s?.round} name=${s?.roundName}`)
  log('--- clicking Start Round 2 ---')
  await call('POST', '/api/host/round/2/start', { host: true, body: {}, preflight: true })
  s = await call('GET', '/api/host/status', { host: true })
  log(`  phase=${s?.phase} round=${s?.round}`)
  await call('POST', '/api/host/game/create', { host: true, body: {} }) // reset to clean lobby
} finally {
  writeFileSync(path.join(root, '_server.log'), serverLog.join(''))
  writeFileSync(path.join(root, '_e2e.log'), out.join('\n'))
  spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'])
  process.exit(0)
}
