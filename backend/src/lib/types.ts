/** Shared data-model types for the MongoDB collections. */

export type GameStatus = 'lobby' | 'playing' | 'completed'

/** Game phase, mirroring the frontend's expectations. */
export type Phase = 'lobby' | 'intro' | 'active' | 'score_revealed' | 'between' | 'completed'

/** How a question is played and scored. */
export type QuestionKind =
  | 'memory' // Memory Grid: show a word grid, then players recall as many words as they can
  | 'text' // Free-text answer, host marks (optionally auto-marked by acceptedAnswers)

export interface TeamDoc {
  _id: string // slug, e.g. 'titans'
  name: string // display name
  order: number
}

export interface PlayerDoc {
  _id: string // userId, e.g. 'GIPL031' (uppercased)
  name: string
  teamId: string // team slug
  score: number
  joined: boolean
  createdAt: Date
  lastSeenAt?: Date
}

/** One question inside a round. */
export interface QuestionDoc {
  _id: string // e.g. 'r1q3'
  kind: QuestionKind
  prompt: string
  /** memory: the words shown on the grid (rows*cols of them). */
  words?: string[]
  rows?: number
  cols?: number
  /** memory: seconds the grid is visible before it hides. */
  showSeconds?: number
  /** Seconds players have to answer (after the grid hides, for memory). */
  answerSeconds: number
  /** text: points for a correct answer. memory: points per correctly spelled word. */
  points: number
  /** text: accepted answers for auto-marking (case-insensitive). */
  acceptedAnswers: string[]
}

export interface RoundDoc {
  _id: string // '1'..'6'
  index: number
  name: string
  instructions: string
  questions: QuestionDoc[]
}

export interface GameDoc {
  _id: 'current' // single active game document
  status: GameStatus
  phase: Phase
  roundIndex: number
  questionIndex: number // index into rounds[roundIndex].questions
  rounds: RoundDoc[]
  startedAt?: Date
  completedAt?: Date
  // Timing of the active question
  questionStartedAt?: Date // memory: grid shown from here
  answerStartsAt?: Date // memory: grid hides + typing opens here
  questionDeadline?: Date
  // Questions already auto-scored (so we never double-award).
  scoredQuestions: string[]
}

export interface AnswerDoc {
  _id: string // uuid
  questionId: string
  roundId: string
  playerId: string
  teamId: string
  text: string
  /** memory: how many submitted words matched the grid (exact spelling). */
  matchedCount?: number
  correct: boolean
  awardedPoints: number
  submittedAt: Date
}
