/** Shared data-model types for the MongoDB collections. */

export type GameStatus = 'lobby' | 'playing' | 'completed'

/** Game phase, mirroring the frontend's expectations. */
export type Phase = 'lobby' | 'intro' | 'active' | 'score_revealed' | 'between' | 'completed'

/** How a question is played and scored. */
export type QuestionKind =
  | 'memory' // Memory Grid: show a word grid, then players recall as many words as they can
  | 'emoji' // Emoji Decode: image + letter blanks; first 3 correct players win 5/3/1
  | 'drawing' // Draw & Guess: one artist per team draws the word; first 5 correct guessers win 5..1
  | 'mcq' // Technical Showdown: multiple choice, one attempt; first 3 correct win 5/3/1
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
  /** text: accepted answers for auto-marking. emoji: [the answer]. */
  acceptedAnswers: string[]
  /** emoji: public image path, e.g. /emojidecode/image1.png */
  image?: string
  /** emoji/drawing/mcq: points for the 1st, 2nd, 3rd… correct player. */
  rankPoints?: number[]
  /** mcq: the choices, in display order (A, B, C, D). */
  options?: string[]
  /** mcq: optional code / data block shown under the question. */
  code?: string
}

/** One pen stroke; points are normalized 0..1 canvas coordinates. */
export interface Stroke {
  id: string
  color: string
  width: number
  points: Array<[number, number]>
}

/** Draw & Guess: one canvas per team per question. _id = `${questionId}:${teamId}` */
export interface DrawingDoc {
  _id: string
  questionId: string
  teamId: string
  strokes: Stroke[]
}

/** Draw & Guess chat line (a guess, or a "guessed it" notice). */
export interface ChatDoc {
  _id: string
  questionId: string
  teamId: string
  playerId: string
  name: string
  text: string // the guess; blank for correct guesses (never revealed in chat)
  correct: boolean
  rank?: number
  at: Date
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
  /** emoji: per question, the player IDs who solved it, in finishing order (max 3). */
  solvers?: Record<string, string[]>
  /** Version of the built-in content this game was created with. */
  contentVersion?: number
  /** drawing: per question, the artist for each team (teamId -> playerId). */
  artists?: Record<string, Record<string, string>>
  /** drawing: per team, who has drawn so far (to rotate artists fairly). */
  artistHistory?: Record<string, string[]>
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
  /** emoji: finishing place (1–3) if this player was among the first three. */
  rank?: number
  /** emoji: number of guesses made. */
  attempts?: number
  correct: boolean
  awardedPoints: number
  submittedAt: Date
}
