/**
 * End-to-end smoke test of the game flow against the real database, using the
 * same engine functions the API routes call. Resets to a clean lobby at the end.
 * Usage: npm run smoke
 */
import './loadenv'

import * as engine from '../src/lib/engine'
import { MEMORY_GRIDS } from '../src/lib/content'
import { COLLECTIONS, collection } from '../src/lib/mongo'
import { ROSTER } from './roster'
import type { PlayerDoc } from '../src/lib/types'

// Run against a separate database so the live game is never touched.
process.env.MONGODB_DB = `${process.env.MONGODB_DB || 'jumble'}_smoke`

async function seedTestRoster() {
  const players = await collection<PlayerDoc>(COLLECTIONS.players)
  await players.deleteMany({})
  await players.insertMany(ROSTER.map((r) => ({ _id: r.id, name: r.name, teamId: r.teamId, score: 0, joined: false, createdAt: new Date() })))
}

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
  console.log(`(using test database "${process.env.MONGODB_DB}")`)
  await seedTestRoster()
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

  // ---------- Round 2: Emoji Decode ----------
  await engine.startRound()
  player = await engine.snapshot({ host: false, playerId: 'GIPL042' })
  check('round 2 = Emoji Decode with 7 questions', player.roundName === 'Emoji Decode' && player.question.scoredCount === 7)
  check('image NOT shown before the question starts', !player.question.questionData.image)

  await engine.startQuestion()
  player = await engine.snapshot({ host: false, playerId: 'GIPL042' })
  const pat = player.question.questionData.pattern as Array<Array<string | null>>
  check('image + blanks shown, 20 sec', player.question.questionData.image === '/emojidecode/image1.png' && player.question.durationSeconds === 20)
  check('blanks: "CLOUD STORAGE" as 5 + 7, all hidden at start', pat.length === 2 && pat[0].length === 5 && pat[1].length === 7 && pat.flat().every((c) => c === null), JSON.stringify(pat))
  host = await engine.snapshot({ host: true })
  check('answer hidden from host screen while live', !host.question.hostAnswer && !host.question.correctAnswer)

  let r: Snap = await engine.submitAnswer('GIPL042', 'r2q1', 'cloud store', 'w1')
  check('wrong guess -> not correct, can retry', r.correct === false && r.answerLocked === false)
  player = await engine.snapshot({ host: false, playerId: 'GIPL042' })
  check('wrong guess does not lock the player', player.player.hasSubmitted === false && player.player.attempts === 1)
  check('guessing too fast is rate-limited', (await rejects(() => engine.submitAnswer('GIPL042', 'r2q1', 'x', 'w2'))) === 'RATE_LIMITED')
  await sleep(800)

  const before = { cad: team(host, 'ctrl-alt-defeat'), tit: team(host, 'titans'), vt: team(host, 'vibe-tribe') }
  r = await engine.submitAnswer('GIPL001', 'r2q1', 'Cloud Storage', 'c1')
  check('first correct -> 1st place, +5', r.correct === true && r.rank === 1 && r.points === 5, JSON.stringify(r))
  player = await engine.snapshot({ host: false, playerId: 'GIPL002' })
  check('others see who already answered', player.solvers?.length === 1 && player.solvers[0].name === 'Kanishkaa' && player.phase === 'active')

  // Two correct answers at the same instant must get different places.
  const [a, b] = await Promise.all([
    engine.submitAnswer('GIPL042', 'r2q1', 'CLOUD-STORAGE', 'c2'),
    engine.submitAnswer('GIPL002', 'r2q1', 'cloudstorage', 'c3'),
  ])
  check('simultaneous answers get 2nd and 3rd (3 and 1 points)', [a.rank, b.rank].sort().join() === '2,3' && a.points! + b.points! === 4, `${a.rank}/${a.points} ${b.rank}/${b.points}`)
  host = await engine.snapshot({ host: true })
  check('question closes automatically when 3 places are taken', host.phase === 'score_revealed' && host.question.correctAnswer === 'Cloud Storage')
  check('team scores: Titans +5, others +3/+1', team(host, 'titans') - before.tit === 5 && team(host, 'ctrl-alt-defeat') - before.cad + team(host, 'vibe-tribe') - before.vt === 4, scores(host))
  const ranks = (host.reviewSubmissions as Snap[]).filter((x) => x.rank).map((x) => `${x.rank}:${x.playerName}`).sort().join(', ')
  check('host sees places + guesses', ranks.startsWith('1:Kanishkaa'), ranks)
  check('late answer after close is rejected', (await rejects(() => engine.submitAnswer('GIPL042', 'r2q1', 'cloud storage', 'late'))) === 'QUESTION_NOT_ACTIVE')

  // Hints: after 25% of 20 s, the first letter of each word appears.
  await engine.nextQuestion()
  await engine.startQuestion()
  await sleep(5300)
  player = await engine.snapshot({ host: false, playerId: 'GIPL042' })
  const hint = (player.question.questionData.pattern as Array<Array<string | null>>).map((w) => w.map((c) => c ?? '_').join('')).join(' ')
  check('first letters revealed after 5 s', hint === 'T__ F_____ A_____________', hint)
  await engine.revealScores()
  player = await engine.snapshot({ host: false, playerId: 'GIPL042' })
  check('nobody solved -> answer shown at reveal', player.question.correctAnswer === 'Two Factor Authentication')

  // Finish the Emoji round.
  await engine.nextQuestion()
  host = await engine.snapshot({ host: true })
  while (host.phase !== 'between') {
    if (host.phase === 'intro') await engine.startQuestion()
    else if (host.phase === 'active') await engine.revealScores()
    else if (host.phase === 'score_revealed') await engine.nextQuestion()
    host = await engine.snapshot({ host: true })
  }
  check('after 7 emoji questions: standings, then round 3', host.round === 3)

  // ---------- Round 3: Draw & Guess ----------
  // A second player per team, so each team has an artist and a guesser.
  await engine.joinByUserId('GIPL003') // Malathy · Ctrl Alt Defeat
  await engine.joinByUserId('GIPL004') // Joni · Titans
  await engine.joinByUserId('GIPL005') // Anita · Vibe Tribe
  await engine.startRound()
  host = await engine.snapshot({ host: true })
  check('round 3 = Draw & Guess with 6 questions, 60 sec', host.roundName === 'Draw & Guess' && host.question.scoredCount === 6 && host.question.durationSeconds === 60)

  await engine.startQuestion()
  host = await engine.snapshot({ host: true })
  const artists = host.question.questionData.artists as Record<string, string>
  check('one artist picked per team', Object.keys(artists).length === 3, JSON.stringify(artists))
  check('host sees canvases but not the word', host.question.questionData.canvases !== undefined && !host.question.hostAnswer && !host.question.correctAnswer)
  const pairs: Record<string, [string, string]> = { 'ctrl-alt-defeat': ['GIPL042', 'GIPL003'], titans: ['GIPL001', 'GIPL004'], 'vibe-tribe': ['GIPL002', 'GIPL005'] }
  const guesserOf = (t: string) => pairs[t].find((id) => id !== artists[t])!
  const artistCad = artists['ctrl-alt-defeat'], guesserCad = guesserOf('ctrl-alt-defeat')
  const artistView: Snap = await engine.snapshot({ host: false, playerId: artistCad })
  const word = artistView.question.questionData.secretCard as string
  check('artist sees the secret word', artistView.question.questionData.isArtist === true && typeof word === 'string' && word.length > 1, word)
  let guesserView: Snap = await engine.snapshot({ host: false, playerId: guesserCad })
  check('guesser does NOT see the word, sees artist name + letter count', !guesserView.question.questionData.secretCard && guesserView.question.questionData.artistName && guesserView.question.questionData.letters === word.length)

  await engine.submitStroke(artistCad, 'r3q1', { id: 's1', color: '#30213e', width: 4, points: [[0.1, 0.1], [0.5, 0.5]] })
  await engine.submitStroke(artistCad, 'r3q1', { id: 's1', color: '#30213e', width: 4, points: [[0.1, 0.1], [0.5, 0.5]] }) // retry
  guesserView = await engine.snapshot({ host: false, playerId: guesserCad })
  check('teammate sees the artist’s stroke live (retry not duplicated)', guesserView.question.questionData.strokes.length === 1)
  const otherTeam: Snap = await engine.snapshot({ host: false, playerId: guesserOf('titans') })
  check('other teams see only their own canvas', otherTeam.question.questionData.strokes.length === 0)
  check('non-artist cannot draw', (await rejects(() => engine.submitStroke(guesserCad, 'r3q1', { id: 's2', color: '#30213e', width: 4, points: [[0, 0]] }))) === 'UNAUTHORIZED')
  check('artist cannot guess', (await rejects(() => engine.submitAnswer(artistCad, 'r3q1', word, 'g0'))) === 'ARTIST_CANNOT_GUESS')

  await engine.submitAnswer(guesserCad, 'r3q1', 'something else', 'g1')
  guesserView = await engine.snapshot({ host: false, playerId: guesserCad })
  check('wrong guess appears in the team chat', guesserView.chat.some((c: Snap) => c.text === 'something else' && !c.correct))
  check('other teams don’t see that chat', !(otherTeam.chat ?? []).some((c: Snap) => c.text === 'something else'))
  await sleep(800)
  const d0 = { cad: team(host, 'ctrl-alt-defeat'), tit: team(host, 'titans') }
  const g1 = await engine.submitAnswer(guesserCad, 'r3q1', word.toLowerCase(), 'g2')
  check('first correct guess -> 1st place, +5', g1.rank === 1 && g1.points === 5, JSON.stringify(g1))
  guesserView = await engine.snapshot({ host: false, playerId: guesserCad })
  const hit = guesserView.chat.find((c: Snap) => c.correct)
  check('chat shows "guessed it" without revealing the word', hit && hit.text === '' && hit.rank === 1)
  const g2 = await engine.submitAnswer(guesserOf('titans'), 'r3q1', word, 'g3')
  check('second correct guess -> 2nd place, +4', g2.rank === 2 && g2.points === 4)
  host = await engine.snapshot({ host: true })
  check('everyone sees the podium; question still open (5 places)', host.solvers.length === 2 && host.phase === 'active' && host.placesTotal === 5)
  check('team scores updated live', team(host, 'ctrl-alt-defeat') - d0.cad === 5 && team(host, 'titans') - d0.tit === 4, scores(host))

  await engine.clearCanvas(artistCad, 'r3q1')
  guesserView = await engine.snapshot({ host: false, playerId: guesserCad })
  check('artist can clear the canvas', guesserView.question.questionData.strokes.length === 0)
  await engine.revealScores()
  guesserView = await engine.snapshot({ host: false, playerId: guesserCad })
  check('reveal shows the word', guesserView.question.correctAnswer === word)

  await engine.nextQuestion()
  await engine.startQuestion()
  host = await engine.snapshot({ host: true })
  const next = host.question.questionData.artists as Record<string, string>
  check('artists rotate: nobody draws twice before teammates', Object.keys(next).every((t) => next[t] !== artists[t]), JSON.stringify(next))
  await engine.revealScores()
  await engine.nextQuestion()
  host = await engine.snapshot({ host: true })
  while (host.phase !== 'between') {
    if (host.phase === 'intro') await engine.startQuestion()
    else if (host.phase === 'active') await engine.revealScores()
    else if (host.phase === 'score_revealed') await engine.nextQuestion()
    host = await engine.snapshot({ host: true })
  }
  check('after 6 drawings: standings, then round 4', host.round === 4)

  // ---------- Round 4: Technical Showdown (final round) ----------
  check('game has 4 rounds now', host.totalRounds === 4)
  await engine.startRound()
  player = await engine.snapshot({ host: false, playerId: 'GIPL042' })
  check('round 4 = Technical Showdown with 6 MCQs', player.roundName === 'Technical Showdown' && player.question.scoredCount === 6)
  check('question + options hidden before start', player.question.options.length === 0)
  await engine.startQuestion()
  player = await engine.snapshot({ host: false, playerId: 'GIPL042' })
  check('MCQ shows question + 4 options, 30 sec', player.question.questionType === 'mcq' && player.question.options.length === 4 && player.question.durationSeconds === 30, player.question.question)
  host = await engine.snapshot({ host: true })
  check('answer hidden from host while live', !host.question.hostAnswer)
  const t0 = { tit: team(host, 'titans'), vt: team(host, 'vibe-tribe'), cad: team(host, 'ctrl-alt-defeat') }

  const w = await engine.submitAnswer('GIPL042', 'r4q1', '500', 'm1')
  check('wrong MCQ answer: locked, correctness not revealed', w.answerLocked === true && w.correct === undefined)
  check('only one attempt per question', (await rejects(() => engine.submitAnswer('GIPL042', 'r4q1', '404', 'm2'))) === 'ANSWER_ALREADY_SUBMITTED')
  check('answer must be one of the options', (await rejects(() => engine.submitAnswer('GIPL003', 'r4q1', 'four oh four', 'm3'))) === 'CONTENT_INVALID')
  const m1 = await engine.submitAnswer('GIPL001', 'r4q1', '404', 'm4')
  const m2 = await engine.submitAnswer('GIPL002', 'r4q1', '404', 'm5')
  check('first correct +5, second +3', m1.rank === 1 && m1.points === 5 && m2.rank === 2 && m2.points === 3)
  await engine.submitAnswer('GIPL003', 'r4q1', '404', 'm6')
  host = await engine.snapshot({ host: true })
  check('closes after 3 correct; reveal shows "C. 404"', host.phase === 'score_revealed' && host.question.correctAnswer === 'C. 404')
  check('team points 5 / 3 / 1', team(host, 'titans') - t0.tit === 5 && team(host, 'vibe-tribe') - t0.vt === 3 && team(host, 'ctrl-alt-defeat') - t0.cad === 1, scores(host))

  await engine.nextQuestion()
  await engine.startQuestion()
  player = await engine.snapshot({ host: false, playerId: 'GIPL042' })
  check('Q2 shows the SQL / data block', String(player.question.questionData.code ?? '').includes('HAVING COUNT(*) >= 2'))
  await engine.revealScores()

  await engine.awardPoints('GIPL042', 10)
  host = await engine.snapshot({ host: true })
  check('manual +10 points', team(host, 'ctrl-alt-defeat') - t0.cad === 11, scores(host))

  // ---------- Rest of the game ----------
  while (host.phase !== 'completed') {
    if (host.phase === 'between') await engine.startRound()
    else if (host.phase === 'intro') await engine.startQuestion()
    else if (host.phase === 'active') await engine.revealScores()
    else if (host.phase === 'score_revealed') await engine.nextQuestion()
    host = await engine.snapshot({ host: true })
  }
  check('game ends after Technical Showdown', host.phase === 'completed' && host.round === 4, scores(host))
  const board = host.leaderboard as Snap[]
  check('individual leaderboard sorted by points', board.length === 6 && board.every((p, i) => i === 0 || board[i - 1].score >= p.score), board.map((p) => `${p.rank}.${p.name}=${p.score}`).join(', '))
  const final: Snap = await engine.snapshot({ host: false, playerId: 'GIPL001' })
  check('players see the leaderboard with themselves marked', final.leaderboard?.some((p: Snap) => p.isYou && p.id === 'GIPL001'))

  // ---------- Reset for the real event ----------
  await engine.createGame()
  host = await engine.snapshot({ host: true })
  check('reset to clean lobby, scores zeroed', host.phase === 'lobby' && host.joined === 0 && (host.teams as Snap[]).every((t) => t.score === 0))

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nALL CHECKS PASSED')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => { console.error('Smoke test error:', e instanceof Error ? e.stack ?? e.message : String(e)); process.exit(1) })
