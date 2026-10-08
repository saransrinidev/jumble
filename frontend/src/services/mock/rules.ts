// Scoring + answer matching + safe expression evaluation for the in-browser
// mock engine. Compact port of the backend game_rules logic.

export interface MockSubmission {
  id: string
  requestId?: string
  answer: string
  playerId: string
  teamId: string
  receivedAt: number
  elapsed: number
  sequence: number
  correct: boolean
  distance?: number
  clueNumber?: number
}

export interface Gain {
  points: number
  playerId: string | null
}

export function normalized(answer: string, output = false): string {
  const text = answer.normalize('NFKC').replace(/\r\n/g, '\n').trim()
  if (output) return text
  return text.toLowerCase().split(/\s+/).filter(Boolean).join(' ')
}

export function matches(question: { answerType: string; acceptedAnswers: string[] }, answer: string): boolean {
  if (question.answerType === 'mcq') return question.acceptedAnswers.includes(answer)
  const output = question.answerType === 'output'
  const target = normalized(answer, output)
  return question.acceptedAnswers.map((a) => normalized(a, output)).includes(target)
}

// --- Safe arithmetic evaluator for the Target round (no eval) ---
type Token = { t: 'num'; v: number } | { t: 'op'; v: '+' | '-' | '*' | '/' } | { t: '(' } | { t: ')' }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]
    if (ch === ' ' || ch === '\t') { i++; continue }
    if (ch >= '0' && ch <= '9') {
      let j = i
      while (j < expr.length && expr[j] >= '0' && expr[j] <= '9') j++
      tokens.push({ t: 'num', v: Number(expr.slice(i, j)) })
      i = j
      continue
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') { tokens.push({ t: 'op', v: ch }); i++; continue }
    if (ch === '(') { tokens.push({ t: '(' }); i++; continue }
    if (ch === ')') { tokens.push({ t: ')' }); i++; continue }
    throw new Error('bad token')
  }
  return tokens
}

/** Returns the integer value, or throws if invalid (used for Target scoring). */
export function expressionValue(
  expression: string,
  numbers: number[],
  operators: string[] | null = null,
  useAll = false,
): number {
  const normalizedExpr = expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
  if (normalizedExpr.length > 200) throw new Error('too long')
  const tokens = tokenize(normalizedExpr)

  const available = new Map<number, number>()
  for (const n of numbers) available.set(n, (available.get(n) ?? 0) + 1)
  const used = new Map<number, number>()

  let pos = 0
  const peek = () => tokens[pos]
  const allow = (sym: '+' | '-' | '*' | '/') => {
    if (operators !== null && !operators.includes(sym)) throw new Error('operator not allowed')
  }

  const parseFactor = (): number => {
    const tok = peek()
    if (!tok) throw new Error('unexpected end')
    if (tok.t === '(') {
      pos++
      const value = parseExpr()
      const close = peek()
      if (!close || close.t !== ')') throw new Error('missing )')
      pos++
      return value
    }
    if (tok.t === 'num') {
      pos++
      if (tok.v <= 0) throw new Error('non-positive')
      used.set(tok.v, (used.get(tok.v) ?? 0) + 1)
      if ((used.get(tok.v) ?? 0) > (available.get(tok.v) ?? 0)) throw new Error('overused')
      return tok.v
    }
    throw new Error('expected factor')
  }
  const parseTerm = (): number => {
    let left = parseFactor()
    for (;;) {
      const tok = peek()
      if (tok && tok.t === 'op' && (tok.v === '*' || tok.v === '/')) {
        allow(tok.v)
        pos++
        const right = parseFactor()
        left = tok.v === '*' ? left * right : left / right
      } else break
    }
    return left
  }
  const parseExpr = (): number => {
    let left = parseTerm()
    for (;;) {
      const tok = peek()
      if (tok && tok.t === 'op' && (tok.v === '+' || tok.v === '-')) {
        allow(tok.v)
        pos++
        const right = parseTerm()
        left = tok.v === '+' ? left + right : left - right
      } else break
    }
    return left
  }

  const result = parseExpr()
  if (pos !== tokens.length) throw new Error('trailing input')
  if (useAll) {
    if (used.size !== available.size) throw new Error('not all used')
    for (const [k, c] of available) if (used.get(k) !== c) throw new Error('not all used')
  }
  if (!Number.isInteger(result)) throw new Error('non-integer')
  return result
}

function points(kind: string, elapsed: number, hard = false, distance?: number): number {
  if (kind === 'memory') return 20 + (elapsed <= 5 ? 5 : 0)
  if (kind === 'emoji') return 20
  if (kind === 'connection') return [40, 30, 20, 10][Math.min(3, Math.floor(elapsed / 7))]
  if (kind === 'target') {
    const d = distance ?? Infinity
    return d === 0 ? 40 : d === 1 ? 30 : d <= 3 ? 20 : d <= 5 ? 10 : 0
  }
  if (kind === 'drawing') return elapsed <= 15 ? 30 : 20
  return hard ? 50 : 30
}

function cmp(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1
    if (a[i] > b[i]) return 1
  }
  return 0
}
function minBy<T>(items: T[], key: (item: T) => number[]): T {
  let best = items[0]
  let bestKey = key(best)
  for (let i = 1; i < items.length; i++) {
    const k = key(items[i])
    if (cmp(k, bestKey) < 0) { best = items[i]; bestKey = k }
  }
  return best
}

/** Choose one scoring submission per team; returns per-team gains. */
export function scoreQuestion(
  question: Record<string, any>,
  kind: string,
  submissions: MockSubmission[],
  teams: Record<string, number>,
  overrides: Record<string, boolean> = {},
): Record<string, Gain> {
  const teamIds = Object.keys(teams)
  const candidates: Record<string, MockSubmission[]> = {}
  for (const t of teamIds) candidates[t] = []
  for (const sub of submissions) {
    if (!(sub.teamId in candidates)) continue
    if (kind === 'target' || (overrides[sub.id] ?? sub.correct)) candidates[sub.teamId].push(sub)
  }
  const winners: Record<string, MockSubmission> = {}
  for (const team of teamIds) {
    const attempts = candidates[team]
    if (attempts.length) {
      winners[team] =
        kind === 'target'
          ? minBy(attempts, (s) => [s.distance ?? Infinity, s.receivedAt, s.sequence])
          : minBy(attempts, (s) => [s.receivedAt, s.sequence])
    }
  }
  const winnerTeams = Object.keys(winners)
  const first = winnerTeams.length
    ? minBy(winnerTeams, (t) => [winners[t].receivedAt, winners[t].sequence])
    : null
  const empty = (): Gain => ({ points: 0, playerId: null })
  if (question.isDemo) return Object.fromEntries(teamIds.map((t) => [t, empty()]))

  if (kind === 'target' && question.scoringRule === 'bank-v2') {
    const exact = Object.values(winners).some((s) => s.distance === 0)
    const ranked = [...winnerTeams].sort((a, b) =>
      cmp(
        [winners[a].distance ?? Infinity, winners[a].receivedAt, winners[a].sequence],
        [winners[b].distance ?? Infinity, winners[b].receivedAt, winners[b].sequence],
      ),
    )
    return Object.fromEntries(
      teamIds.map((team) => {
        if (!(team in winners)) return [team, empty()]
        const idx = ranked.indexOf(team)
        const pts = exact ? (winners[team].distance === 0 ? 40 : 0) : idx < 3 ? [30, 20, 10][idx] : 0
        return [team, { points: pts, playerId: winners[team].playerId }]
      }),
    )
  }
  if (kind === 'memory' && question.scoringRule === 'bank-v2') {
    return Object.fromEntries(
      teamIds.map((team) => (team in winners ? [team, { points: 20, playerId: winners[team].playerId }] : [team, empty()])),
    )
  }
  if (kind === 'drawing' && question.scoringRule === 'bank-v2') {
    return Object.fromEntries(
      teamIds.map((team) => {
        if (!(team in winners)) return [team, empty()]
        const e = winners[team].elapsed
        return [team, { points: e <= 15 ? 30 : e <= 30 ? 20 : 10, playerId: winners[team].playerId }]
      }),
    )
  }
  return Object.fromEntries(
    teamIds.map((team) => {
      if (!(team in winners)) return [team, empty()]
      const w = winners[team]
      const bonus = (kind === 'emoji' || kind === 'technical') && team === first ? 10 : 0
      return [team, { points: points(kind, w.elapsed, Boolean(question.hard), w.distance) + bonus, playerId: w.playerId }]
    }),
  )
}
