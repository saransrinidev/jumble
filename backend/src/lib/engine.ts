/**
 * Game engine over MongoDB. One active game document (_id: 'current').
 * - Host opens the game; players join by user ID and wait in the lobby.
 * - The game has 6 rounds; each round holds one or more questions.
 * - Host drives: start round -> start question -> close -> next question/round.
 * - Questions auto-score when they close; the host can mark/adjust manually.
 * - Team totals are the sum of their players' scores.
 */
import { randomUUID } from 'node:crypto'
import { COLLECTIONS, collection } from './mongo'
import { AppError } from './envelope'
import { CONTENT_VERSION, DRAW, defaultRounds, emojiHint, lettersOnly, matchMemoryWords } from './content'
import type { AnswerDoc, ChatDoc, DrawingDoc, GameDoc, PlayerDoc, QuestionDoc, RoundDoc, Stroke, TeamDoc } from './types'

export const TEAM_DEFS: TeamDoc[] = [
  { _id: 'ctrl-alt-defeat', name: 'Ctrl Alt Defeat', order: 0 },
  { _id: 'titans', name: 'Titans', order: 1 },
  { _id: 'vibe-tribe', name: 'Vibe Tribe', order: 2 },
]

/** Answers arriving this soon after the deadline still count (auto-submit / network lag). */
const GRACE_MS = 3000

async function teamsCol() {
  return collection<TeamDoc>(COLLECTIONS.teams)
}
async function playersCol() {
  return collection<PlayerDoc>(COLLECTIONS.players)
}
async function gameCol() {
  return collection<GameDoc>(COLLECTIONS.game)
}
async function answersCol() {
  return collection<AnswerDoc>(COLLECTIONS.answers)
}
async function drawingsCol() {
  return collection<DrawingDoc>(COLLECTIONS.drawings)
}
async function chatCol() {
  return collection<ChatDoc>(COLLECTIONS.chat)
}

/** Questions where the first N correct players win points (live race). */
function isRace(question: QuestionDoc): boolean {
  return question.kind === 'emoji' || question.kind === 'drawing' || question.kind === 'mcq'
}

export function teamDisplayName(teamId: string): string {
  return TEAM_DEFS.find((t) => t._id === teamId)?.name ?? teamId
}

/** Ensure the three canonical teams exist. */
export async function ensureTeams(): Promise<void> {
  const col = await teamsCol()
  for (const team of TEAM_DEFS) {
    await col.updateOne({ _id: team._id }, { $setOnInsert: team }, { upsert: true })
  }
}

// ---------- Game document ----------

function isCurrentShape(game: GameDoc): boolean {
  return Array.isArray(game.rounds?.[0]?.questions) && typeof game.questionIndex === 'number'
}

export async function getGame(): Promise<GameDoc | null> {
  const game = await (await gameCol()).findOne({ _id: 'current' })
  if (!game) return null
  // Saved by an older version: replace with a fresh lobby so the round/question
  // flow always has valid data. New built-in content refreshes a waiting lobby.
  if (!isCurrentShape(game)) return createGame()
  if (game.status === 'lobby' && game.contentVersion !== CONTENT_VERSION) {
    await (await gameCol()).updateOne({ _id: 'current' }, { $set: { rounds: defaultRounds(), contentVersion: CONTENT_VERSION } })
    return { ...game, rounds: defaultRounds(), contentVersion: CONTENT_VERSION }
  }
  return game
}

export async function requireGame(): Promise<GameDoc> {
  const game = await getGame()
  if (!game) throw new AppError('NO_ACTIVE_GAME', 'There is no active game.', 404)
  return game
}

function current(game: GameDoc): { round: RoundDoc; question: QuestionDoc } {
  const round = game.rounds[game.roundIndex]
  return { round, question: round.questions[game.questionIndex] }
}

function findQuestion(game: GameDoc, questionId: string) {
  for (let r = 0; r < game.rounds.length; r++) {
    const q = game.rounds[r].questions.findIndex((x) => x._id === questionId)
    if (q !== -1) return { r, q, question: game.rounds[r].questions[q] }
  }
  return null
}

/** Create a fresh game (lobby): resets scores, answers and presence; keeps the roster. */
export async function createGame(): Promise<GameDoc> {
  await ensureTeams()
  const game: GameDoc = {
    _id: 'current',
    status: 'lobby',
    phase: 'lobby',
    roundIndex: 0,
    questionIndex: 0,
    rounds: defaultRounds(),
    scoredQuestions: [],
    solvers: {},
    contentVersion: CONTENT_VERSION,
    artists: {},
    artistHistory: {},
  }
  await (await gameCol()).replaceOne({ _id: 'current' }, game, { upsert: true })
  await (await answersCol()).deleteMany({})
  await (await drawingsCol()).deleteMany({})
  await (await chatCol()).deleteMany({})
  // Players still on the page re-mark themselves as joined on their next poll.
  await (await playersCol()).updateMany({}, { $set: { score: 0, joined: false } })
  return game
}

// ---------- Roster / players ----------

export async function addPlayer(userId: string, name: string, teamId: string): Promise<PlayerDoc> {
  const id = userId.trim().toUpperCase()
  if (!id) throw new AppError('CONTENT_INVALID', 'A user ID is required.')
  if (!TEAM_DEFS.some((t) => t._id === teamId)) throw new AppError('CONTENT_INVALID', 'Unknown team.')
  await (await playersCol()).updateOne(
    { _id: id },
    { $set: { name: name.trim() || id, teamId }, $setOnInsert: { score: 0, joined: false, createdAt: new Date() } },
    { upsert: true },
  )
  return (await (await playersCol()).findOne({ _id: id }))!
}

export async function removePlayer(userId: string): Promise<void> {
  const id = userId.trim().toUpperCase()
  await (await playersCol()).deleteOne({ _id: id })
  await (await answersCol()).deleteMany({ playerId: id })
}

export async function listPlayers(): Promise<PlayerDoc[]> {
  return (await playersCol()).find({}).sort({ teamId: 1, _id: 1 }).toArray()
}

/** Player: join by userId. The host must have added it first. */
export async function joinByUserId(userId: string): Promise<{ player: PlayerDoc; game: GameDoc }> {
  const id = userId.trim().toUpperCase()
  const player = await (await playersCol()).findOne({ _id: id })
  if (!player) {
    throw new AppError('EMPLOYEE_NOT_FOUND', 'That user ID is not on the roster. Check the ID from your host.', 404)
  }
  await (await playersCol()).updateOne({ _id: id }, { $set: { joined: true, lastSeenAt: new Date() } })
  const game = await getGame()
  if (!game) throw new AppError('NO_ACTIVE_GAME', 'The host has not opened a game yet.', 404)
  return { player: { ...player, joined: true }, game }
}

/** Heartbeat: mark a polling player as present in the current session. */
export async function touchPlayer(playerId: string | null | undefined): Promise<void> {
  if (!playerId) return
  const id = playerId.trim().toUpperCase()
  const staleBefore = new Date(Date.now() - 10_000)
  await (await playersCol()).updateOne(
    { _id: id, $or: [{ joined: false }, { lastSeenAt: { $lt: staleBefore } }, { lastSeenAt: { $exists: false } }] },
    { $set: { joined: true, lastSeenAt: new Date() } },
  )
}

/** Reject polls from IDs that aren't on the roster (e.g. a stale browser session). */
export async function requireRosterPlayer(playerId: string | null | undefined): Promise<void> {
  const id = (playerId ?? '').trim().toUpperCase()
  const found = id ? await (await playersCol()).findOne({ _id: id }, { projection: { _id: 1 } }) : null
  if (!found) throw new AppError('UNAUTHORIZED', 'Your session has expired. Enter your user ID again to rejoin.', 403)
}

// ---------- Host game flow ----------

export async function startGame(): Promise<void> {
  const game = await requireGame()
  if (game.status !== 'lobby') return
  const joinedCount = await (await playersCol()).countDocuments({ joined: true })
  if (joinedCount < 1) throw new AppError('PLAYERS_REQUIRED', 'Wait for at least one player to join.')
  await (await gameCol()).updateOne(
    { _id: 'current' },
    { $set: { status: 'playing', phase: 'intro', roundIndex: 0, questionIndex: 0, startedAt: new Date() } },
  )
}

/** From the between-rounds leaderboard, open the next round's introduction. */
export async function startRound(): Promise<void> {
  const game = await requireGame()
  if (game.phase === 'intro') return
  if (game.phase !== 'between') throw new AppError('INVALID_PHASE', 'The next round is not ready.', 409)
  await (await gameCol()).updateOne({ _id: 'current' }, { $set: { phase: 'intro' } })
}

/** Open the current question. Memory questions show the grid first, then open typing. */
export async function startQuestion(): Promise<void> {
  const game = await requireGame()
  if (game.phase === 'active') return
  if (!['intro', 'between'].includes(game.phase)) {
    throw new AppError('INVALID_PHASE', 'Start from the question introduction.', 409)
  }
  const { question } = current(game)
  const now = Date.now()
  const show = question.kind === 'memory' ? (question.showSeconds ?? 5) * 1000 : 0
  const answerStartsAt = new Date(now + show)
  const deadline = new Date(answerStartsAt.getTime() + (question.answerSeconds ?? 30) * 1000)
  const set: Record<string, unknown> = { phase: 'active', questionStartedAt: new Date(now), answerStartsAt, questionDeadline: deadline }
  if (question.kind === 'drawing') {
    const { artists, history } = await pickArtists(game)
    set[`artists.${question._id}`] = artists
    set.artistHistory = history
  }
  await (await gameCol()).updateOne({ _id: 'current' }, { $set: set })
}

/**
 * Draw & Guess: pick one artist per team from the players who are in the game,
 * rotating so nobody draws twice until everyone on their team has drawn.
 */
async function pickArtists(game: GameDoc): Promise<{ artists: Record<string, string>; history: Record<string, string[]> }> {
  const joined = await (await playersCol()).find({ joined: true }).toArray()
  const artists: Record<string, string> = {}
  const history: Record<string, string[]> = { ...(game.artistHistory ?? {}) }
  for (const team of TEAM_DEFS) {
    const members = joined.filter((p) => p.teamId === team._id).map((p) => p._id)
    if (!members.length) continue
    let drawn = (history[team._id] ?? []).filter((id) => members.includes(id))
    let pool = members.filter((id) => !drawn.includes(id))
    if (!pool.length) { drawn = []; pool = members } // everyone has drawn: start a new rotation
    const pick = pool[Math.floor(Math.random() * pool.length)]
    artists[team._id] = pick
    history[team._id] = [...drawn, pick]
  }
  return { artists, history }
}

function artistOf(game: GameDoc, questionId: string, teamId: string): string | undefined {
  return game.artists?.[questionId]?.[teamId]
}

/** Draw & Guess: the team's artist adds a stroke to their team's canvas. */
export async function submitStroke(playerId: string, questionId: string, stroke: Stroke): Promise<{ ok: true }> {
  const id = playerId.trim().toUpperCase()
  const player = await (await playersCol()).findOne({ _id: id })
  if (!player) throw new AppError('UNAUTHORIZED', 'Unknown player.', 403)
  const game = await requireGame()
  const { question } = current(game)
  if (question._id !== questionId || question.kind !== 'drawing' || game.phase !== 'active') {
    throw new AppError('QUESTION_NOT_ACTIVE', 'Drawing is closed.', 409)
  }
  if (game.questionDeadline && Date.now() > new Date(game.questionDeadline).getTime()) {
    throw new AppError('QUESTION_NOT_ACTIVE', 'Time is up.', 409)
  }
  if (artistOf(game, questionId, player.teamId) !== id) throw new AppError('UNAUTHORIZED', 'Only your team’s artist can draw.', 403)

  // Validate + shrink the payload (3 decimals is plenty for an 800px canvas).
  if (!stroke || typeof stroke.id !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(stroke.color ?? '') || !Array.isArray(stroke.points) || !stroke.points.length) {
    throw new AppError('CONTENT_INVALID', 'Invalid stroke.')
  }
  const clean: Stroke = {
    id: stroke.id.slice(0, 80),
    color: stroke.color,
    width: Math.min(24, Math.max(1, Math.round(Number(stroke.width) || 4))),
    points: stroke.points.slice(0, 500).map(([x, y]) => [
      Math.round(Math.min(1, Math.max(0, Number(x) || 0)) * 1000) / 1000,
      Math.round(Math.min(1, Math.max(0, Number(y) || 0)) * 1000) / 1000,
    ]),
  }
  const _id = `${questionId}:${player.teamId}`
  const drawings = await drawingsCol()
  const existing = (await drawings.findOne({ _id }, { projection: { 'strokes.id': 1 } }))?.strokes ?? []
  if (existing.some((s) => s.id === clean.id)) return { ok: true } // retry of the same stroke
  if (existing.length >= DRAW.maxStrokes) throw new AppError('DRAWING_LIMIT', 'The canvas is full — clear it to keep drawing.')
  await drawings.updateOne(
    { _id },
    { $push: { strokes: clean }, $setOnInsert: { questionId, teamId: player.teamId } },
    { upsert: true },
  )
  return { ok: true }
}

/** Draw & Guess: the artist clears their team's canvas. */
export async function clearCanvas(playerId: string, questionId: string): Promise<{ ok: true }> {
  const id = playerId.trim().toUpperCase()
  const player = await (await playersCol()).findOne({ _id: id })
  if (!player) throw new AppError('UNAUTHORIZED', 'Unknown player.', 403)
  const game = await requireGame()
  if (current(game).question._id !== questionId || game.phase !== 'active') throw new AppError('QUESTION_NOT_ACTIVE', 'Drawing is closed.', 409)
  if (artistOf(game, questionId, player.teamId) !== id) throw new AppError('UNAUTHORIZED', 'Only your team’s artist can draw.', 403)
  await (await drawingsCol()).updateOne({ _id: `${questionId}:${player.teamId}` }, { $set: { strokes: [] } })
  return { ok: true }
}

/** Close the current question: auto-score (once) and show the scorecard. */
export async function revealScores(): Promise<void> {
  const game = await requireGame()
  if (game.phase === 'score_revealed') return
  if (game.phase !== 'active') throw new AppError('INVALID_PHASE', 'No question is running.', 409)
  await autoScoreQuestion(current(game).question, game)
  await (await gameCol()).updateOne({ _id: 'current' }, { $set: { phase: 'score_revealed' } })
}

/** Next question in this round, or the between-rounds leaderboard, or the end. */
export async function nextQuestion(): Promise<void> {
  const game = await requireGame()
  if (game.phase !== 'score_revealed') throw new AppError('INVALID_PHASE', 'Finish this question first.', 409)
  const round = game.rounds[game.roundIndex]
  if (game.questionIndex < round.questions.length - 1) {
    await (await gameCol()).updateOne({ _id: 'current' }, { $set: { phase: 'intro', questionIndex: game.questionIndex + 1 } })
  } else if (game.roundIndex < game.rounds.length - 1) {
    await (await gameCol()).updateOne(
      { _id: 'current' },
      { $set: { phase: 'between', roundIndex: game.roundIndex + 1, questionIndex: 0 } },
    )
  } else {
    await finishGame()
  }
}

/** Kept for the existing route name: "next round" now means "next step". */
export const nextRound = nextQuestion

export async function finishGame(): Promise<void> {
  await (await gameCol()).updateOne(
    { _id: 'current' },
    { $set: { phase: 'completed', status: 'completed', completedAt: new Date() } },
  )
}

/** Host: edit a (text) question's prompt / accepted answers / points / time. */
export async function saveQuestion(
  idOrRound: string,
  patch: { prompt?: string; acceptedAnswers?: string[]; points?: number; answerSeconds?: number },
): Promise<void> {
  const game = await requireGame()
  let loc = findQuestion(game, idOrRound)
  if (!loc) {
    // Backward compatible: a round id edits that round's current/first question.
    const r = game.rounds.findIndex((x) => x._id === idOrRound)
    if (r === -1) throw new AppError('CONTENT_INVALID', 'Unknown question.')
    const q = r === game.roundIndex ? game.questionIndex : 0
    loc = { r, q, question: game.rounds[r].questions[q] }
  }
  const set: Record<string, unknown> = {}
  const base = `rounds.${loc.r}.questions.${loc.q}`
  if (patch.prompt !== undefined) set[`${base}.prompt`] = patch.prompt
  if (patch.acceptedAnswers !== undefined) set[`${base}.acceptedAnswers`] = patch.acceptedAnswers
  if (patch.points !== undefined) set[`${base}.points`] = patch.points
  if (patch.answerSeconds !== undefined) set[`${base}.answerSeconds`] = patch.answerSeconds
  if (Object.keys(set).length) await (await gameCol()).updateOne({ _id: 'current' }, { $set: set })
}
/** Kept for the existing route name. */
export const saveRound = saveQuestion

// ---------- Scoring ----------

/** Set an answer's result, applying only the point difference to the player's score. */
async function applyResult(ans: AnswerDoc, correct: boolean, award: number, extra: Partial<AnswerDoc> = {}): Promise<void> {
  const delta = award - (ans.awardedPoints ?? 0)
  await (await answersCol()).updateOne({ _id: ans._id }, { $set: { ...extra, correct, awardedPoints: award } })
  if (delta !== 0) await (await playersCol()).updateOne({ _id: ans.playerId }, { $inc: { score: delta } })
}

/**
 * Auto-score a question once, when it closes.
 * - memory: points per correctly spelled grid word.
 * - text: only if the host set accepted answers; otherwise the host's marks stand.
 */
async function autoScoreQuestion(question: QuestionDoc, game: GameDoc): Promise<void> {
  if (game.scoredQuestions.includes(question._id)) return
  const answers = await (await answersCol()).find({ questionId: question._id }).toArray()
  if (question.kind === 'memory') {
    for (const ans of answers) {
      const matched = matchMemoryWords(ans.text, question.words ?? []).length
      await applyResult(ans, matched > 0, matched * question.points, { matchedCount: matched })
    }
  } else if (isRace(question)) {
    // Already scored live, the moment each player answered correctly.
  } else {
    const accepted = (question.acceptedAnswers ?? []).map(normalize).filter(Boolean)
    if (accepted.length) {
      for (const ans of answers) {
        const correct = accepted.includes(normalize(ans.text))
        await applyResult(ans, correct, correct ? question.points : 0)
      }
    }
  }
  await (await gameCol()).updateOne({ _id: 'current' }, { $addToSet: { scoredQuestions: question._id } })
}

/** Host marks a text answer correct/incorrect (any time). Memory answers are scored automatically. */
export async function reviewAnswer(answerId: string, correct: boolean): Promise<void> {
  const ans = await (await answersCol()).findOne({ _id: answerId })
  if (!ans) throw new AppError('SUBMISSION_NOT_FOUND', 'Answer not found.', 404)
  const game = await requireGame()
  const question = findQuestion(game, ans.questionId)?.question
  if (question && (question.kind === 'memory' || isRace(question))) {
    throw new AppError('INVALID_ACTION', 'This round is scored automatically. Use Award points to adjust.')
  }
  const points = question?.points ?? 20
  await applyResult(ans, correct, correct ? points : 0)
}

/** Host manual adjustment: add (or subtract) points for a player. */
export async function awardPoints(playerId: string, points: number): Promise<void> {
  const id = playerId.trim().toUpperCase()
  const player = await (await playersCol()).findOne({ _id: id })
  if (!player) throw new AppError('EMPLOYEE_NOT_FOUND', 'Unknown player.', 404)
  await (await playersCol()).updateOne({ _id: id }, { $inc: { score: points } })
}

/** Host: set a player's absolute score. */
export async function setScore(playerId: string, score: number): Promise<void> {
  const id = playerId.trim().toUpperCase()
  await (await playersCol()).updateOne({ _id: id }, { $set: { score } })
}

// ---------- Player submission ----------

export async function submitAnswer(
  playerId: string,
  questionId: string,
  text: string,
  _requestId: string,
): Promise<SubmitResult> {
  const id = playerId.trim().toUpperCase()
  const player = await (await playersCol()).findOne({ _id: id })
  if (!player) throw new AppError('UNAUTHORIZED', 'Unknown player.', 403)
  const game = await requireGame()
  const { round, question } = current(game)
  if (question._id !== questionId || game.phase !== 'active') {
    throw new AppError('QUESTION_NOT_ACTIVE', 'This question is not currently open.', 409)
  }
  const now = Date.now()
  if (game.answerStartsAt && now < new Date(game.answerStartsAt).getTime()) {
    throw new AppError('QUESTION_NOT_ACTIVE', 'Answers open when the grid hides.', 409)
  }
  if (game.questionDeadline && now > new Date(game.questionDeadline).getTime() + GRACE_MS) {
    throw new AppError('QUESTION_NOT_ACTIVE', 'Time is up for this question.', 409)
  }
  const clean = text.slice(0, 4000)
  if (question.kind === 'drawing' && artistOf(game, question._id, player.teamId) === id) {
    throw new AppError('ARTIST_CANNOT_GUESS', 'You’re the artist this time — draw, don’t guess!', 403)
  }
  if (isRace(question)) return submitRace(player, round._id, question, clean)
  const matchedCount = question.kind === 'memory' ? matchMemoryWords(clean, question.words ?? []).length : undefined
  // One answer per player per question (a resubmission replaces it before close).
  const col = await answersCol()
  const existing = await col.findOne({ questionId, playerId: id })
  if (existing) {
    await col.updateOne({ _id: existing._id }, { $set: { text: clean, matchedCount, submittedAt: new Date() } })
  } else {
    await col.insertOne({
      _id: randomUUID(),
      questionId,
      roundId: round._id,
      playerId: id,
      teamId: player.teamId,
      text: clean,
      matchedCount,
      correct: false,
      awardedPoints: 0,
      submittedAt: new Date(),
    })
  }
  return { answerLocked: false }
}

export interface SubmitResult {
  answerLocked: boolean
  correct?: boolean
  rank?: number
  points?: number
}

/**
 * Emoji Decode guess. Wrong guesses can be retried. A correct guess claims the
 * next finishing place atomically (so two simultaneous answers can't both be
 * 1st); places 1–3 score rankPoints, later correct answers score 0. When all
 * places are taken the question closes automatically.
 */
async function submitRace(player: PlayerDoc, roundId: string, question: QuestionDoc, text: string): Promise<SubmitResult> {
  const playerId = player._id
  const teamId = player.teamId
  const answers = await answersCol()
  const existing = await answers.findOne({ questionId: question._id, playerId })
  if (existing?.correct) return { answerLocked: true, correct: true, rank: existing.rank, points: existing.awardedPoints }
  if (question.kind === 'mcq') {
    // One attempt only — otherwise players could just click through every option.
    if (existing) throw new AppError('ANSWER_ALREADY_SUBMITTED', 'You already answered this question.', 409)
    if (!(question.options ?? []).includes(text)) throw new AppError('CONTENT_INVALID', 'Pick one of the options.')
  }
  if (existing && Date.now() - new Date(existing.submittedAt).getTime() < 700) {
    throw new AppError('RATE_LIMITED', 'Slow down a little — try again in a moment.', 429)
  }

  const correct =
    question.kind === 'mcq'
      ? text === question.acceptedAnswers[0]
      : lettersOnly(text) !== '' && lettersOnly(text) === lettersOnly(question.acceptedAnswers[0] ?? '')
  // One answer doc per player per question, updated on every guess.
  await answers.updateOne(
    { questionId: question._id, playerId },
    {
      $set: { text, submittedAt: new Date(), teamId, roundId },
      $inc: { attempts: 1 },
      $setOnInsert: { _id: randomUUID(), correct: false, awardedPoints: 0 },
    },
    { upsert: true },
  )
  if (!correct) {
    if (question.kind === 'drawing') await postChat(question._id, player, text.slice(0, 60), false)
    // MCQ: the wrong answer is final. Correctness isn't revealed until the question closes.
    return question.kind === 'mcq' ? { answerLocked: true } : { answerLocked: false, correct: false }
  }

  const places = question.rankPoints ?? [5, 3, 1]
  const key = `solvers.${question._id}`
  const claimed = await (await gameCol()).findOneAndUpdate(
    { _id: 'current', phase: 'active', [`${key}.${places.length - 1}`]: { $exists: false }, [key]: { $ne: playerId } },
    { $push: { [key]: playerId } },
    { returnDocument: 'after', projection: { solvers: 1 } },
  )
  const order = claimed?.solvers?.[question._id] ?? []
  const rank = claimed ? order.indexOf(playerId) + 1 : undefined
  const points = rank ? places[rank - 1] ?? 0 : 0

  const doc = (await answers.findOne({ questionId: question._id, playerId }))!
  await applyResult(doc, true, points, { rank })
  // The word itself never goes into the chat — just that they got it.
  if (question.kind === 'drawing') await postChat(question._id, player, '', true, rank)

  // All finishing places taken: close the question for everyone.
  if (claimed && order.length >= places.length) await revealScores().catch(() => {})
  return { answerLocked: true, correct: true, rank, points }
}

async function postChat(questionId: string, player: PlayerDoc, text: string, correct: boolean, rank?: number): Promise<void> {
  await (await chatCol()).insertOne({
    _id: randomUUID(),
    questionId,
    teamId: player.teamId,
    playerId: player._id,
    name: player.name,
    text,
    correct,
    rank,
    at: new Date(),
  })
}

/** Lazily auto-close the active question once its deadline (plus grace) has passed. */
export async function autoExpire(): Promise<void> {
  const game = await getGame()
  if (
    game &&
    game.phase === 'active' &&
    game.questionDeadline &&
    Date.now() >= new Date(game.questionDeadline).getTime() + GRACE_MS
  ) {
    await revealScores()
  }
}

// ---------- Snapshot ----------

function normalize(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ')
}

function iso(d?: Date): string | undefined {
  return d ? new Date(d).toISOString() : undefined
}

function questionView(game: GameDoc, round: RoundDoc, question: QuestionDoc, host: boolean): Record<string, unknown> {
  const now = Date.now()
  const active = game.phase === 'active'
  const revealed = ['score_revealed', 'completed'].includes(game.phase)
  const answerAt = game.answerStartsAt ? new Date(game.answerStartsAt).getTime() : 0
  const prep = active && now < answerAt
  const base = {
    id: question._id,
    number: game.questionIndex + 1,
    scoredCount: round.questions.length,
    isDemo: false,
    options: [],
    points: question.points,
    instructions: round.instructions,
    deadline: iso(game.questionDeadline),
    subphase: prep ? 'prepare' : 'answer',
  }

  if (question.kind === 'memory') {
    const words = question.words ?? []
    return {
      ...base,
      question: prep ? 'Memorize the grid!' : active ? 'Type every word you remember' : 'Memory Grid',
      questionType: 'words',
      gameType: 'memory',
      // Words are sent only while the grid is visible, then again at the reveal.
      // Not even the host gets them mid-typing: the host screen is often projected.
      questionData: prep
        ? { rows: question.rows ?? 5, cols: question.cols ?? 5, cells: words, slots: words.length }
        : { slots: words.length },
      durationSeconds: prep ? question.showSeconds ?? 5 : question.answerSeconds,
      startedAt: iso(prep ? game.questionStartedAt : game.answerStartsAt),
      correctAnswer: revealed ? words.join(' · ') : undefined,
      hostAnswer: revealed && host ? words.join(' · ') : undefined,
    }
  }

  if (question.kind === 'mcq') {
    const options = question.options ?? []
    const answer = question.acceptedAnswers[0] ?? ''
    const letter = 'ABCDEFGH'[options.indexOf(answer)] ?? ''
    const shown = active || revealed // nothing to read ahead on the intro screen
    return {
      ...base,
      question: shown ? question.prompt : 'Get ready…',
      questionType: 'mcq',
      gameType: 'technical',
      questionData: shown && question.code ? { code: question.code } : {},
      options: shown ? options : [],
      durationSeconds: question.answerSeconds,
      startedAt: iso(game.answerStartsAt ?? game.questionStartedAt),
      correctAnswer: revealed ? `${letter}. ${answer}` : undefined,
      hostAnswer: revealed && host ? `${letter}. ${answer}` : undefined,
    }
  }

  if (question.kind === 'drawing') {
    // Canvas / artist details are filled in by snapshot(), which knows the viewer.
    return {
      ...base,
      question: active ? 'Draw & Guess' : revealed ? 'The word was…' : 'Draw & Guess',
      questionType: 'chat',
      gameType: 'drawing',
      questionData: {},
      durationSeconds: question.answerSeconds,
      startedAt: iso(game.answerStartsAt ?? game.questionStartedAt),
      correctAnswer: revealed ? question.acceptedAnswers[0] : undefined,
      hostAnswer: revealed && host ? question.acceptedAnswers[0] : undefined,
    }
  }

  if (question.kind === 'emoji') {
    const answer = question.acceptedAnswers[0] ?? ''
    const start = answerAt || now
    const total = (question.answerSeconds ?? 20) * 1000
    const progress = revealed ? 1 : active ? Math.min(1, (now - start) / total) : 0
    return {
      ...base,
      question: question.prompt,
      questionType: 'fill',
      gameType: 'emoji',
      // The image only appears once the question starts — no peeking from the intro.
      questionData: active || revealed ? { image: question.image, pattern: emojiHint(answer, progress) } : {},
      durationSeconds: question.answerSeconds,
      startedAt: iso(game.answerStartsAt ?? game.questionStartedAt),
      correctAnswer: revealed ? answer : undefined,
      // The host screen is often projected, so it gets the answer only at the reveal.
      hostAnswer: revealed && host ? answer : undefined,
    }
  }

  return {
    ...base,
    question: question.prompt,
    questionType: 'text',
    gameType: 'technical',
    questionData: {},
    durationSeconds: question.answerSeconds,
    startedAt: iso(game.answerStartsAt ?? game.questionStartedAt),
    correctAnswer: revealed || host ? question.acceptedAnswers[0] : undefined,
    hostAnswer: host ? question.acceptedAnswers[0] : undefined,
  }
}

/** Build the snapshot the frontend expects. */
export async function snapshot(opts: { host: boolean; playerId?: string | null }): Promise<Record<string, unknown>> {
  const game = await getGame()
  if (!game) throw new AppError('NO_ACTIVE_GAME', 'There is no active game.', 404)

  const players = await listPlayers()
  const { round, question } = current(game)
  const qAnswers = await (await answersCol()).find({ questionId: question._id }).toArray()

  const teams = TEAM_DEFS.map((t) => {
    const members = players.filter((p) => p.teamId === t._id)
    return {
      id: t._id,
      name: t.name,
      joined: members.filter((m) => m.joined).length,
      total: members.length,
      submitted: new Set(qAnswers.filter((a) => a.teamId === t._id).map((a) => a.playerId)).size,
      members: opts.host ? members.map((m) => m.name) : [],
      score: members.reduce((sum, p) => sum + (p.score ?? 0), 0),
      roundGain: qAnswers.filter((a) => a.teamId === t._id).reduce((sum, a) => sum + (a.awardedPoints ?? 0), 0),
    }
  })

  const viewerId = opts.playerId ? opts.playerId.toUpperCase() : null
  const viewer = viewerId ? players.find((p) => p._id === viewerId) ?? null : null
  const isLastQuestion = game.roundIndex === game.rounds.length - 1 && game.questionIndex === round.questions.length - 1

  const result: Record<string, unknown> = {
    id: 'current',
    title: 'Jumble',
    status: game.status,
    phase: game.phase,
    round: game.roundIndex + 1,
    totalRounds: game.rounds.length,
    roundId: round._id,
    roundName: round.name,
    roundDescription: round.instructions,
    joined: players.filter((p) => p.joined).length,
    total: players.length,
    submitted: new Set(qAnswers.map((a) => a.playerId)).size,
    isLastQuestion,
    serverTime: new Date().toISOString(),
    teams,
    // Only players who have actually joined appear in the lobby list.
    participants:
      opts.host || viewer
        ? players
            .filter((p) => p.joined)
            .map((p) => ({ id: p._id, name: p.name, teamId: p.teamId, joinedAt: iso(p.lastSeenAt), isYou: p._id === viewer?._id }))
        : [],
  }

  if (game.status !== 'lobby') result.question = questionView(game, round, question, opts.host)

  // Final results: every player ranked by points (equal scores share a rank).
  if (game.status === 'completed') {
    const ranked = players.filter((p) => p.joined || p.score).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    let rank = 0
    let last: number | undefined
    result.leaderboard = ranked.map((p, i) => {
      if (p.score !== last) { rank = i + 1; last = p.score }
      return { rank, id: p._id, name: p.name, teamId: p.teamId, score: p.score, isYou: p._id === viewerId }
    })
  }

  // Race rounds: everyone sees who has already solved it, in finishing order.
  if (isRace(question) && game.status !== 'lobby') {
    const places = question.rankPoints ?? [5, 3, 1]
    result.solvers = (game.solvers?.[question._id] ?? []).map((pid, i) => {
      const p = players.find((x) => x._id === pid)
      return { rank: i + 1, points: places[i] ?? 0, name: p?.name ?? pid, teamId: p?.teamId ?? '', isYou: pid === viewerId }
    })
    result.placesTotal = places.length
    result.placePoints = places
  }

  // Draw & Guess: artists, canvases and the team chat.
  if (question.kind === 'drawing' && game.status !== 'lobby') {
    const q = result.question as Record<string, unknown>
    const live = game.phase === 'active'
    const shown = live || ['score_revealed', 'completed'].includes(game.phase)
    const word = question.acceptedAnswers[0] ?? ''
    const artists = game.artists?.[question._id] ?? {}
    const artistNames = Object.fromEntries(Object.entries(artists).map(([t, pid]) => [t, players.find((p) => p._id === pid)?.name ?? pid]))
    const canvases: Record<string, Stroke[]> = shown
      ? Object.fromEntries((await (await drawingsCol()).find({ questionId: question._id }).toArray()).map((d) => [d.teamId, d.strokes]))
      : {}
    if (opts.host) {
      q.questionData = { canvases, artists, artistNames, letters: word.length }
    } else if (viewer) {
      const isArtist = artists[viewer.teamId] === viewer._id
      q.questionData = {
        isArtist,
        // Only the artist ever gets the word while the question is live.
        secretCard: isArtist && live ? word : undefined,
        strokes: canvases[viewer.teamId] ?? [],
        artistId: artists[viewer.teamId],
        artistName: artistNames[viewer.teamId],
        letters: word.length,
      }
      const lines = await (await chatCol()).find({ questionId: question._id, teamId: viewer.teamId }).sort({ at: -1 }).limit(40).toArray()
      result.chat = lines.reverse().map((c) => ({ id: c._id, name: c.name, text: c.text, correct: c.correct, rank: c.rank, isYou: c.playerId === viewer._id }))
    }
  }

  if (opts.host) {
    const startAt = game.answerStartsAt ?? game.questionStartedAt
    result.reviewSubmissions = qAnswers.map((a) => ({
      id: a._id,
      playerId: a.playerId,
      teamId: a.teamId,
      playerName: players.find((p) => p._id === a.playerId)?.name ?? a.playerId,
      answer: a.text,
      kind: question.kind,
      matchedCount: a.matchedCount,
      rank: a.rank,
      attempts: a.attempts,
      correct: a.correct,
      awardedPoints: a.awardedPoints,
      elapsed: startAt ? Math.max(0, (new Date(a.submittedAt).getTime() - new Date(startAt).getTime()) / 1000) : 0,
    }))
  }

  if (viewer) {
    const own = qAnswers.find((a) => a.playerId === viewer._id)
    const revealed = ['score_revealed', 'completed'].includes(game.phase)
    result.player = {
      id: viewer._id,
      name: viewer.name,
      teamId: viewer.teamId,
      gameId: 'current',
      score: viewer.score,
      previousScore: viewer.score,
      // Emoji: a wrong guess doesn't lock you out — only solving does.
      // Emoji/drawing: a wrong guess doesn't lock you out — only solving does.
      hasSubmitted: question.kind === 'emoji' || question.kind === 'drawing' ? Boolean(own?.correct) : Boolean(own),
      answer: own?.text,
      earnedPoints: own?.awardedPoints ?? 0,
      recallCorrect: revealed ? own?.matchedCount ?? 0 : undefined,
      rank: own?.rank,
      attempts: own?.attempts ?? 0,
      isCorrect: revealed ? own?.correct ?? false : undefined,
    }
  }

  return result
}
