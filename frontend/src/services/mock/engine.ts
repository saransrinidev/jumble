// In-browser game engine for the standalone (no-backend) static build.
// Holds the full game state, simulates opponents + an auto-host, and produces
// snapshots in the same shape the real backend returned, so the existing
// frontend normalize/UI work unchanged.
import bank from './question_bank_v2.json'
import { expressionValue, matches, scoreQuestion, type Gain, type MockSubmission } from './rules'

const ROUND_NAMES = ['Memory Grid', 'Emoji Decode', 'Connection Hunt', 'Target Drop', 'Draw & Guess', 'Technical Showdown']
const TEAM_DEFS = [
  { id: 'ctrl-alt-defeat', name: 'Ctrl Alt Defeat', slug: 'ctrl-alt-defeat' },
  { id: 'titans', name: 'Titans', slug: 'titans' },
  { id: 'vibe-tribe', name: 'Vibe Tribe', slug: 'vibe-tribe' },
]
const BOT_NAMES = ['Ada', 'Alan', 'Grace', 'Linus', 'Rhea', 'Dev', 'Mira', 'Sam', 'Nia', 'Omar']

type AnyObj = Record<string, any>
const now = () => Date.now() / 1000
const iso = (s: number) => new Date(s * 1000).toISOString()
const uuid = () => (crypto?.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2))

interface Player { id: string; name: string; team_id: string; isBot: boolean }
interface Store {
  gameId: string
  status: 'lobby' | 'playing' | 'paused' | 'completed'
  title: string
  content: AnyObj
  players: Player[]
  humanId: string | null
  runtime: AnyObj | null
  endedReason?: string
}

const KEY = 'jumble.mock.v1'

function freshContent(): AnyObj {
  return JSON.parse(JSON.stringify(bank))
}

function load(): Store | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Store) : null
  } catch {
    return null
  }
}

let store: Store | null = load()

function persist() {
  try {
    if (store) localStorage.setItem(KEY, JSON.stringify(store))
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore quota errors */
  }
}

function teamScores(): Record<string, number> {
  return Object.fromEntries(TEAM_DEFS.map((t) => [t.id, 0]))
}

/** Build the flattened question list the runtime iterates over. */
function buildQuestions(content: AnyObj): AnyObj[] {
  const questions: AnyObj[] = []
  content.rounds.forEach((r: AnyObj, i: number) => {
    r.questions.forEach((q: AnyObj, j: number) => {
      questions.push({
        ...q,
        kind: r.gameType,
        round: i,
        number: q.isDemo ? 0 : r.questions.slice(0, j + 1).filter((p: AnyObj) => !p.isDemo).length,
        scoredCount: r.questions.filter((v: AnyObj) => !v.isDemo).length,
      })
    })
  })
  return questions
}

/** Ensure a game exists with content + bot players so a solo user can play. */
export function ensureGame(): Store {
  if (store && store.status !== 'completed') return store
  const gameId = uuid()
  const players: Player[] = []
  // Seed two bots per team so the two-per-team start rule passes.
  TEAM_DEFS.forEach((team, ti) => {
    for (let k = 0; k < 2; k++) {
      players.push({ id: uuid(), name: BOT_NAMES[(ti * 2 + k) % BOT_NAMES.length], team_id: team.id, isBot: true })
    }
  })
  store = {
    gameId,
    status: 'lobby',
    title: 'Jumble',
    content: freshContent(),
    players,
    humanId: null,
    runtime: null,
  }
  persist()
  return store
}

export function activeGame(): AnyObj | null {
  if (!store || store.status === 'completed') return null
  return { id: store.gameId, title: store.title, status: store.status }
}

export function joinHuman(name: string): AnyObj {
  const s = ensureGame()
  // One human; assign to the team with the fewest humans (round-robin by hash).
  const team = TEAM_DEFS[Math.abs(hash(name)) % TEAM_DEFS.length]
  let human = s.players.find((p) => p.id === s.humanId && !p.isBot)
  if (!human) {
    human = { id: uuid(), name: name.trim() || 'You', team_id: team.id, isBot: false }
    s.players.push(human)
    s.humanId = human.id
  } else {
    human.name = name.trim() || human.name
  }
  persist()
  return {
    player: { id: human.id, name: human.name },
    team: { id: human.team_id, name: teamNameOf(human.team_id) },
    game: { id: s.gameId, status: s.status },
  }
}

function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0
  return h
}

function teamNameOf(id: string): string {
  return TEAM_DEFS.find((t) => t.id === id)?.name ?? id
}

// ---- Host-driven state machine (mirrors the backend engine) ----

export function startGame(): AnyObj {
  const s = ensureGame()
  if (s.status !== 'lobby') return { started: true }
  const questions = buildQuestions(s.content)
  const zeros = teamScores()
  s.runtime = {
    questions,
    index: 0,
    phase: 'intro',
    scores: { ...zeros },
    baseScores: { ...zeros },
    contributions: {},
    baseContributions: {},
    gains: {},
    submissions: [],
    overrides: {},
    sequence: 0,
    clueCount: 1,
  }
  s.status = 'playing'
  persist()
  return { started: true }
}

function closeQuestion(rt: AnyObj) {
  const q = rt.questions[rt.index]
  const gains = scoreQuestion(q, q.kind, rt.submissions as MockSubmission[], rt.scores, rt.overrides)
  rt.gains = gains
  rt.scores = Object.fromEntries(Object.keys(gains).map((t) => [t, rt.baseScores[t] + gains[t].points]))
  rt.contributions = { ...rt.baseContributions }
  for (const g of Object.values<Gain>(gains)) {
    if (g.playerId) rt.contributions[g.playerId] = (rt.contributions[g.playerId] ?? 0) + g.points
  }
  rt.phase = 'score_revealed'
}

export function hostAction(action: string): AnyObj {
  const s = store
  if (!s || !s.runtime) throw mockError('QUESTION_NOT_ACTIVE', 'The game has not started.', 409)
  const rt = s.runtime
  const q = rt.questions[rt.index]
  if (action === 'round') {
    if (rt.phase === 'between') rt.phase = 'intro'
    else if (rt.phase !== 'intro') throw mockError('INVALID_PHASE', 'The next round is not ready.', 409)
  } else if (action === 'question') {
    if (rt.phase === 'active') return { ok: true }
    if (rt.phase !== 'intro') throw mockError('INVALID_PHASE', 'Start from the question introduction.', 409)
    const t = now()
    const prep = ['memory', 'drawing'].includes(q.kind) ? q.memoryTime ?? 10 : 0
    rt.phase = 'active'
    rt.startedAt = t
    rt.answerStartsAt = t + prep
    rt.deadline = t + prep + (q.answerTime ?? 30)
    rt.baseScores = { ...rt.scores }
    rt.baseContributions = { ...rt.contributions }
    rt.clueCount = 1
  } else if (['end', 'answer', 'scores'].includes(action)) {
    if (rt.phase === 'score_revealed') return { ok: true }
    if (rt.phase !== 'active') throw mockError('INVALID_PHASE', 'No question is running.', 409)
    closeQuestion(rt)
  } else if (action === 'clue') {
    if (rt.phase !== 'active' || q.kind !== 'connection') throw mockError('INVALID_PHASE', 'No connection question is running.', 409)
    const automatic = Math.min(4, Math.floor((now() - rt.answerStartsAt) / 7) + 1)
    rt.clueCount = Math.min(4, Math.max(rt.clueCount ?? 1, automatic) + 1)
  } else if (['next', 'complete', 'finish'].includes(action)) {
    if (rt.phase !== 'score_revealed') throw mockError('INVALID_PHASE', 'Finish this question first.', 409)
    if (rt.index === rt.questions.length - 1) {
      rt.phase = 'completed'
      s.status = 'completed'
    } else if (action === 'finish') {
      throw mockError('INVALID_PHASE', 'There are questions remaining.', 409)
    } else {
      const oldRound = q.round
      rt.index += 1
      rt.submissions = []
      rt.overrides = {}
      rt.gains = {}
      rt.clueCount = 1
      rt.phase = rt.questions[rt.index].round !== oldRound ? 'between' : 'intro'
    }
  } else {
    throw mockError('INVALID_ACTION', 'Unknown game action.')
  }
  persist()
  return { ok: true }
}

export function createGame(): AnyObj {
  // Replace any active session with a fresh lobby (bots reseeded).
  store = null
  const s = ensureGame()
  return { id: s.gameId, title: s.title, status: s.status }
}

export function replay(): AnyObj {
  return createGame()
}

export function submit(playerId: string, questionId: string, answer: string, requestId: string): AnyObj {
  const s = store
  if (!s || !s.runtime) throw mockError('QUESTION_NOT_ACTIVE', 'The game has not started.', 409)
  const rt = s.runtime
  const player = s.players.find((p) => p.id === playerId)
  if (!player) throw mockError('UNAUTHORIZED', 'Unauthorized action.', 403)
  const t = now()
  const q = rt.questions[rt.index]
  const dup = (rt.submissions as MockSubmission[]).find((a) => a.requestId === requestId && a.playerId === playerId)
  if (dup) return { answerLocked: false }
  if (q.id !== questionId || rt.phase !== 'active' || !(rt.answerStartsAt <= t && t < rt.deadline)) {
    throw mockError('QUESTION_NOT_ACTIVE', 'Answers are accepted only during the answering phase.', 409)
  }
  const team = player.team_id
  if (q.kind !== 'target' && (rt.submissions as MockSubmission[]).some((a) => a.correct && a.teamId === team)) {
    return { answerLocked: true }
  }
  if (q.lockAfterAttempt && (rt.submissions as MockSubmission[]).some((a) => a.teamId === team)) {
    throw mockError('ANSWER_ALREADY_SUBMITTED', 'Your team answer is locked.', 409)
  }
  let distance: number | undefined
  if (q.kind === 'target') {
    try {
      distance = Math.abs(expressionValue(answer, q.data.numbers, q.data.operators ?? null, q.data.useAllNumbers ?? false) - q.data.target)
    } catch {
      throw mockError('INVALID_EXPRESSION', 'Use the supplied numbers with +, −, ×, ÷ and parentheses; the result must be an integer.')
    }
  }
  rt.sequence += 1
  const sub: MockSubmission = {
    id: uuid(),
    requestId,
    answer,
    playerId,
    teamId: team,
    receivedAt: t,
    elapsed: t - rt.answerStartsAt,
    sequence: rt.sequence,
    correct: q.kind === 'target' ? distance === 0 : matches(q, answer),
  }
  if (distance !== undefined) sub.distance = distance
  ;(rt.submissions as MockSubmission[]).push(sub)
  persist()
  return { answerLocked: Boolean(q.lockAfterAttempt) || (sub.correct && q.kind !== 'target') }
}

export function review(submissionId: string, correct: boolean): AnyObj {
  const s = store
  if (!s || !s.runtime) throw mockError('QUESTION_NOT_ACTIVE', 'The game has not started.', 409)
  const rt = s.runtime
  if (rt.phase !== 'score_revealed') throw mockError('INVALID_PHASE', 'Review after the question closes.', 409)
  rt.overrides[submissionId] = correct
  closeQuestion(rt)
  persist()
  return { ok: true }
}

function mockError(code: string, message: string, status = 400) {
  return { __mock: true, code, message, status }
}

// ---- Snapshot builders (shape matches the backend responses) ----

function rosterTeams(withMembers: boolean): AnyObj[] {
  const s = store!
  return TEAM_DEFS.map((team) => {
    const members = s.players.filter((p) => p.team_id === team.id)
    const item: AnyObj = {
      id: team.id,
      name: team.name,
      slug: team.slug,
      joined: members.length,
      total: members.length,
      score: 0,
    }
    if (withMembers) item.members = members.map((p) => p.name)
    return item
  })
}

function participants(viewerId: string | null): AnyObj[] {
  const s = store!
  return s.players.map((p) => ({ id: p.id, name: p.name, teamId: p.team_id, isYou: p.id === viewerId }))
}

function questionView(rt: AnyObj, host: boolean): AnyObj {
  const q = rt.questions[rt.index]
  const t = now()
  const phase = rt.phase
  const revealed = ['score_revealed', 'completed'].includes(phase)
  const active = phase === 'active'
  const prep = active && t < rt.answerStartsAt

  let data: AnyObj = {}
  if (q.kind === 'memory' && prep) data = { ...q.data }
  else if (q.kind === 'connection' && active) {
    const count = Math.max(rt.clueCount ?? 1, Math.min(4, Math.floor((t - rt.answerStartsAt) / 7) + 1))
    data = { clues: (q.data.clues ?? []).slice(0, count) }
  } else if (!['memory', 'connection', 'drawing'].includes(q.kind)) {
    for (const k of ['puzzle', 'target', 'numbers', 'code', 'image', 'operators', 'useAllNumbers']) {
      if (k in q.data) data[k] = q.data[k]
    }
  }
  if (q.kind === 'drawing') {
    data = { isArtist: false }
    if (host) data.secretCard = q.prompt
  }

  const view: AnyObj = {
    id: q.id,
    question:
      q.kind === 'drawing'
        ? 'Draw the secret card'
        : q.kind === 'memory' && (prep || ['intro', 'between'].includes(phase))
          ? 'Remember this visual'
          : q.prompt,
    questionType: q.answerType,
    gameType: q.kind,
    questionData: data,
    options: !prep ? q.options : [],
    number: q.number,
    isDemo: q.isDemo ?? false,
    scoredCount: q.scoredCount ?? 6,
    instructions: q.instructions ?? '',
    lockAfterAttempt: q.lockAfterAttempt ?? false,
    durationSeconds: prep ? q.memoryTime ?? 10 : q.answerTime ?? 30,
    startedAt: iso(prep ? rt.startedAt : rt.answerStartsAt ?? t),
    subphase: prep ? 'prepare' : 'answer',
    deadline: iso(rt.deadline ?? t),
  }
  if (revealed || host) {
    view.correctAnswer = q.kind === 'target' ? q.data.exampleSolution || String(q.data.target) : q.acceptedAnswers[0]
  }
  if (host) view.hostAnswer = view.correctAnswer
  return view
}

/** Base game+teams snapshot (host or public). */
export function gameSnapshot(host: boolean, playerId: string | null = null): AnyObj {
  const s = store
  if (!s) throw mockError('NO_ACTIVE_GAME', 'There is no active game.', 404)
  autoExpire()
  const viewer = playerId ? s.players.find((p) => p.id === playerId) : null
  const result: AnyObj = {
    id: s.gameId,
    title: s.title,
    status: s.status,
    current_round: s.runtime?.questions?.[s.runtime.index]?.round ?? 0,
    teams: rosterTeams(host || Boolean(viewer)),
    joined: s.players.length,
    total: s.players.length,
    participants: host || viewer ? participants(playerId) : [],
    endedReason: s.endedReason,
    newGameAvailable: false,
  }

  const rt = s.runtime
  if (rt && (rt.index || ['playing', 'paused', 'completed'].includes(s.status) || s.status === 'completed')) {
    const q = rt.questions[rt.index]
    const submissions = rt.submissions as MockSubmission[]
    result.phase = rt.phase
    result.round = q.round + 1
    result.roundId = String(q.round + 1)
    result.roundName = ROUND_NAMES[q.round]
    result.roundDescription = '30 seconds to answer. Every team counts.'
    result.question = questionView(rt, host)
    result.serverTime = iso(now())
    result.submitted = new Set(submissions.map((a) => a.playerId)).size
    result.isLastQuestion = rt.index === rt.questions.length - 1
    for (const team of result.teams as AnyObj[]) {
      team.score = rt.scores[team.id] ?? 0
      team.roundGain = rt.gains[team.id]?.points ?? 0
      team.submitted = new Set(submissions.filter((a) => a.teamId === team.id).map((a) => a.playerId)).size
    }
    if (host) result.reviewSubmissions = submissions.map((a) => ({ ...a, correct: rt.overrides[a.id] ?? a.correct }))
    if (viewer) {
      const team = viewer.team_id
      const own = submissions.filter((a) => a.playerId === playerId)
      const solved =
        (submissions.some((a) => a.correct && a.teamId === team) && q.kind !== 'target') ||
        (q.lockAfterAttempt && submissions.some((a) => a.teamId === team))
      const gain: Gain = rt.gains[team] ?? { points: 0, playerId: null }
      const revealed = ['score_revealed', 'completed'].includes(rt.phase)
      result.player = {
        score: rt.contributions[playerId!] ?? 0,
        previousScore: rt.baseContributions[playerId!] ?? 0,
        hasSubmitted: solved,
        attemptCount: own.length,
        earnedPoints: gain.playerId === playerId ? gain.points : 0,
        isCorrect: revealed ? own.some((a) => rt.overrides[a.id] ?? a.correct) : null,
      }
    }
  } else {
    result.phase = 'lobby'
    result.round = 0
    result.roundName = 'Awaiting round content'
    result.roundDescription = 'The host will start the game shortly.'
  }
  return result
}

/** Player-state snapshot (adds the normalized player object). */
export function playerState(playerId: string, _gameId: string): AnyObj {
  const s = store
  if (!s) throw mockError('NO_ACTIVE_GAME', 'There is no active game.', 404)
  const player = s.players.find((p) => p.id === playerId)
  if (!player) throw mockError('UNAUTHORIZED', 'Unauthorized action.', 403)
  const snap = gameSnapshot(false, playerId)
  const live = snap.player ?? {}
  snap.player = {
    id: player.id,
    name: player.name,
    teamId: player.team_id,
    gameId: s.gameId,
    score: 0,
    hasSubmitted: false,
    waitingForGame: false,
    ...live,
  }
  return snap
}

// ---- Auto-expire + bot/host simulation ----

function autoExpire() {
  const s = store
  if (!s || !s.runtime) return
  const rt = s.runtime
  if (rt.phase === 'active' && now() >= rt.deadline) {
    closeQuestion(rt)
    persist()
  }
}

/** Bots answer the current question with plausible timing. Called by the driver. */
export function simulateBots() {
  const s = store
  if (!s || !s.runtime) return
  const rt = s.runtime
  if (rt.phase !== 'active') return
  const t = now()
  if (t < rt.answerStartsAt) return
  const q = rt.questions[rt.index]
  for (const bot of s.players.filter((p) => p.isBot)) {
    const already = (rt.submissions as MockSubmission[]).some((a) => a.playerId === bot.id)
    if (already) continue
    // Each bot answers once, at a random moment in the window, ~65% correct.
    if (Math.random() < 0.25) continue // not yet this tick
    const correct = Math.random() < 0.65
    const answer = botAnswer(q, correct)
    if (answer === null) continue
    try {
      submit(bot.id, q.id, answer, uuid())
    } catch {
      /* locked or closed; ignore */
    }
  }
}

function botAnswer(q: AnyObj, correct: boolean): string | null {
  const accepted: string[] = q.acceptedAnswers ?? []
  if (q.kind === 'target') {
    // Produce an expression; correct hits target, else a near miss.
    const nums: number[] = q.data.numbers ?? []
    if (nums.length < 2) return null
    if (correct && q.data.exampleSolution) return q.data.exampleSolution
    return `${nums[0]}+${nums[1]}`
  }
  if (q.answerType === 'mcq') {
    const opts: string[] = q.options ?? []
    if (!opts.length) return null
    if (correct && accepted[0]) return accepted[0]
    return opts[Math.floor(Math.random() * opts.length)]
  }
  if (correct && accepted[0]) return accepted[0]
  return 'guess'
}

export function hasActiveSession(): boolean {
  return Boolean(store && store.status !== 'completed')
}

// ---- Content authoring (host content editor) ----

export function gameContent(): AnyObj {
  const s = ensureGame()
  return { ...s.content, version: s.content.version ?? 0 }
}

export function saveContent(doc: AnyObj): AnyObj {
  const s = ensureGame()
  if (s.status !== 'lobby') throw mockError('CONTENT_LOCKED', 'Content cannot be changed after the game starts.', 409)
  s.content = { rounds: doc.rounds }
  s.content.version = (doc.version ?? 0) + 1
  persist()
  return { ...s.content, errors: contentErrors(s.content) }
}

export function validateContent(): AnyObj {
  const s = ensureGame()
  const errors = contentErrors(s.content)
  return { ready: errors.length === 0, errors }
}

/** Minimal structured validation used by the content editor's readiness check. */
export function contentErrors(document: AnyObj): Array<{ path: string; message: string }> {
  const errors: Array<{ path: string; message: string }> = []
  const add = (path: string, message: string) => errors.push({ path, message })
  ;(document.rounds ?? []).forEach((round: AnyObj, i: number) => {
    const questions: AnyObj[] = round.questions ?? []
    if (!questions.length) add(`rounds.${i}`, 'Add at least one question.')
    questions.forEach((q, j) => {
      const path = `rounds.${i}.questions.${j}`
      if (!String(q.prompt ?? '').trim()) add(path + '.prompt', 'Enter a question or secret card.')
      if (round.gameType !== 'target' && !(q.acceptedAnswers ?? []).some((a: string) => a.trim())) {
        add(path + '.acceptedAnswers', 'Enter at least one accepted answer.')
      }
    })
  })
  return errors
}
