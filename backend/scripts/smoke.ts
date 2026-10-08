/**
 * End-to-end smoke test of the game flow against the real database, using the
 * same engine functions the API routes call. Resets to a clean lobby at the end.
 * Usage: npm run smoke
 */
import './loadenv'

import * as engine from '../src/lib/engine'
import { MEMORY_GRIDS } from '../src/lib/content'

type Snap = Record<string, any>
let failures = 0
function check(label: string, cond: boolean, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`)
  if (!cond) failures++
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const team = (s: Snap, id: string) => (s.teams as Snap[]).find((t) => t.id === id)!.score as number
const scores = (s: Snap) => (s.teams as Snap[]).map((t) => `${t.name}=${t.score}`).join(', ')
async function rejects(fn: () => Promise<unknown>): Promise<string> {
  try { await fn(); return '' } catch (e) { return (e as { code?: string }).code ?? 'ERR' }
}

async function main() {
  // ---------- Lobby ----------
  await engine.createGame()
  let host: Snap = await engine.snapshot({ host: true })
  check('fresh lobby', host.phase === 'lobby' && host.joined === 0, `joined=${host.joined}/${host.total}`)

  await engine.joinByUserId('gipl042') // Harshavarthan · Ctrl Alt Defeat
  await engine.joinByUserId('GIPL001') // Kanishkaa · Titans
  await engine.joinByUserId('GIPL002') // Sanjai · Vibe Tribe
  host = await engine.snapshot({ host: true })
  check('join count updates live', host.joined === 3, `joined=${host.joined}/${host.total}`)
  check('lobby lists only joined players', host.participants.length === 3)
  check('unknown user ID rejected', (await rejects(() => engine.joinByUserId('NOPE999'))) !== '')
  check('stale demo session -> UNAUTHORIZED', (await rejects(() => engine.requireRosterPlayer('3e1d9f9a-d1c8-478c'))) === 'UNAUTHORIZED')

  // ---------- Memory Grid, question 1 ----------
  await engine.startGame()
  let player: Snap = await engine.snapshot({ host: false, playerId: 'GIPL042' })
  check('round 1 = Memory Grid with 6 questions', player.roundName === 'Memory Grid' && player.question.scoredCount === 6)
  check('words NOT sent before the question starts', !player.question.questionData.cells)

  await engine.startQuestion()
  player = await engine.snapshot({ host: false, playerId: 'GIPL042' })
  check('grid visible: 25 words, 5x5, 5 sec', player.question.questionData.cells?.length === 25 && player.question.questionData.cols === 5 && player.question.durationSeconds === 5 && player.question.subphase === 'prepare')
  check('typing blocked while grid is visible', (await rejects(() => engine.submitAnswer('GIPL042', 'r1q1', 'APPLE', 'x'))) === 'QUESTION_NOT_ACTIVE')

  await sleep(5300)
  player = await engine.snapshot({ host: false, playerId: 'GIPL042' })
  check('grid hidden after 5 sec, 15 sec to type', !player.question.questionData.cells && player.question.durationSeconds === 15 && player.question.subphase === 'answer')
  host = await engine.snapshot({ host: true })
  check('host screen does not show the words mid-typing either', !host.question.questionData.cells && !host.question.hostAnswer)

  const grid = MEMORY_GRIDS[0]
  // Harshavarthan: 5 correct (one typed twice, lower-case), 1 misspelled, 1 not on grid
  await engine.submitAnswer('GIPL042', 'r1q1', ['apple', 'CHAIR', 'River', 'clock', 'TIGER', 'apple', 'PENCLE', 'ZEBRA'].join('\n'), 'a')
  // Kanishkaa: 2 correct
  await engine.submitAnswer('GIPL001', 'r1q1', [grid[10], grid[24]].join('\n'), 'b')
  // Sanjai: only misspellings
  await engine.submitAnswer('GIPL002', 'r1q1', ['APPEL', 'CLOK'].join('\n'), 'c')
  host = await engine.snapshot({ host: true })
  const live = Object.fromEntries((host.reviewSubmissions as Snap[]).map((r) => [r.playerName, r.matchedCount]))
  check('host sees live correct-word counts', live['Harshavarthan'] === 5 && live['Kanishkaa'] === 2 && live['Sanjai'] === 0, JSON.stringify(live))

  await engine.revealScores()
  host = await engine.snapshot({ host: true })
  check('scored: 1 pt per correctly spelled word (5 / 2 / 0)', team(host, 'ctrl-alt-defeat') === 5 && team(host, 'titans') === 2 && team(host, 'vibe-tribe') === 0, scores(host))
  player = await engine.snapshot({ host: false, playerId: 'GIPL042' })
  check('player sees own result after reveal', player.player.recallCorrect === 5 && player.player.earnedPoints === 5 && player.question.correctAnswer.split(' · ').length === 25)
  const memAnswerId = (host.reviewSubmissions as Snap[])[0].id
  check('memory answers cannot be ✓/✗-marked', (await rejects(() => engine.reviewAnswer(memAnswerId, true))) === 'INVALID_ACTION')
  await engine.revealScores() // a duplicate close must not double-score
  host = await engine.snapshot({ host: true })
  check('closing twice does not double-score', team(host, 'ctrl-alt-defeat') === 5)

  // ---------- Questions 2..6 of Memory Grid ----------
  await engine.nextQuestion()
  host = await engine.snapshot({ host: true })
  check('next question stays in Memory Grid (Q2 of 6)', host.phase === 'intro' && host.round === 1 && host.question.number === 2)
  check('Q2 uses a different grid', host.question.id === 'r1q2')
  for (let q = 2; q <= 6; q++) {
    await engine.startQuestion()
    await engine.revealScores()
    await engine.nextQuestion()
  }
  host = await engine.snapshot({ host: true })
  check('after Q6: standings, then round 2', host.phase === 'between' && host.round === 2 && host.roundName === 'Emoji Decode')

  // ---------- Round 2 (host-typed text question) ----------
  await engine.startRound()
  await engine.saveQuestion('r2q1', { prompt: 'Capital of France?', acceptedAnswers: ['Paris'], points: 20 })
  await engine.startQuestion()
  await engine.submitAnswer('GIPL002', 'r2q1', 'paris', 'd')
  await engine.submitAnswer('GIPL001', 'r2q1', 'Lyon', 'e')
  await engine.revealScores()
  host = await engine.snapshot({ host: true })
  check('text round auto-marks preset answer (+20)', team(host, 'vibe-tribe') === 20, scores(host))
  const lyon = (host.reviewSubmissions as Snap[]).find((r) => r.answer === 'Lyon')!
  await engine.reviewAnswer(lyon.id, true)
  await engine.reviewAnswer(lyon.id, true)
  host = await engine.snapshot({ host: true })
  check('host ✓ adds once (+20, not +40)', team(host, 'titans') === 22, scores(host))
  await engine.awardPoints('GIPL042', 10)
  host = await engine.snapshot({ host: true })
  check('manual +10 points', team(host, 'ctrl-alt-defeat') === 15, scores(host))

  // ---------- Rest of the game ----------
  while (host.phase !== 'completed') {
    if (host.phase === 'between') await engine.startRound()
    else if (host.phase === 'intro') await engine.startQuestion()
    else if (host.phase === 'active') await engine.revealScores()
    else if (host.phase === 'score_revealed') await engine.nextQuestion()
    host = await engine.snapshot({ host: true })
  }
  check('game completes with team totals', host.phase === 'completed', scores(host))

  // ---------- Reset for the real event ----------
  await engine.createGame()
  host = await engine.snapshot({ host: true })
  check('reset to clean lobby, scores zeroed', host.phase === 'lobby' && host.joined === 0 && (host.teams as Snap[]).every((t) => t.score === 0))

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nALL CHECKS PASSED')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => { console.error('Smoke test error:', e instanceof Error ? e.stack ?? e.message : String(e)); process.exit(1) })
