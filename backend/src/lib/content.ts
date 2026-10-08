/**
 * Built-in game content. Round 1 (Memory Grid) is fully defined here; rounds
 * 2–6 are single host-typed questions until each game is built out.
 */
import type { QuestionDoc, RoundDoc } from './types'

/** Memory Grid timing + scoring (edit here to tune the game). */
export const MEMORY = {
  rows: 5,
  cols: 5,
  showSeconds: 5, // grid visible
  answerSeconds: 15, // typing time after it hides
  pointsPerWord: 1, // per correctly spelled word
}

/** Six 5×5 grids — 25 distinct, common, easy-to-spell words each. */
export const MEMORY_GRIDS: string[][] = [
  ['APPLE', 'CHAIR', 'RIVER', 'CLOCK', 'TIGER', 'PENCIL', 'CLOUD', 'BREAD', 'HORSE', 'LEMON', 'CANDLE', 'MIRROR', 'ROCKET', 'GARDEN', 'PILLOW', 'TRAIN', 'OCEAN', 'MANGO', 'JACKET', 'BUTTON', 'PLANET', 'CAMERA', 'SPOON', 'BRIDGE', 'TOMATO'],
  ['LAPTOP', 'PIZZA', 'DESERT', 'VIOLIN', 'KITE', 'MONKEY', 'HAMMER', 'SUGAR', 'WINDOW', 'CASTLE', 'ORANGE', 'TICKET', 'FOREST', 'BOTTLE', 'PEPPER', 'DOLPHIN', 'WALLET', 'ISLAND', 'CARROT', 'GUITAR', 'LADDER', 'COFFEE', 'PARROT', 'BASKET', 'THUNDER'],
  ['MOUSE', 'BANANA', 'SCHOOL', 'ENGINE', 'FEATHER', 'POTATO', 'BUCKET', 'MARKET', 'RABBIT', 'PAPER', 'TUNNEL', 'CHEESE', 'ZEBRA', 'HELMET', 'CANYON', 'PEACOCK', 'MAGNET', 'SANDAL', 'COOKIE', 'DRAGON', 'VALLEY', 'PUZZLE', 'GLOVE', 'LANTERN', 'ONION'],
  ['TEACUP', 'SPIDER', 'VILLAGE', 'BLANKET', 'SALMON', 'HONEY', 'TABLET', 'SUNSET', 'PENGUIN', 'CARPET', 'GRAPES', 'ANCHOR', 'BICYCLE', 'CACTUS', 'PRINTER', 'LOBSTER', 'MEADOW', 'POCKET', 'CHERRY', 'TROPHY', 'WHISTLE', 'IGLOO', 'NAPKIN', 'VOLCANO', 'BADGE'],
  ['KEYBOARD', 'LION', 'MUFFIN', 'HARBOR', 'SCARF', 'TURTLE', 'PALACE', 'KETTLE', 'PUMPKIN', 'ROBOT', 'SADDLE', 'GALAXY', 'FOUNTAIN', 'PEANUT', 'EAGLE', 'ENVELOPE', 'TEMPLE', 'WAFFLE', 'COMPASS', 'OTTER', 'BALLOON', 'CRAYON', 'GLACIER', 'MITTEN', 'SPINACH'],
  ['MONITOR', 'GIRAFFE', 'PICNIC', 'LIGHTHOUSE', 'SOCKET', 'WALNUT', 'JUNGLE', 'TOASTER', 'FALCON', 'CUSHION', 'MEDAL', 'OYSTER', 'TRACTOR', 'VANILLA', 'CAVE', 'SPONGE', 'CHIMNEY', 'KOALA', 'HAMMOCK', 'PRETZEL', 'RAINBOW', 'STAPLER', 'BEETLE', 'MARBLE', 'NOODLE'],
]

/** Emoji Decode timing + scoring. */
export const EMOJI = {
  answerSeconds: 20,
  rankPoints: [5, 3, 1], // 1st, 2nd, 3rd correct player
  // Hint letters appear at these fractions of the answer time:
  // first letter of each word, then the last letter, then the middle letter.
  revealAt: [0.25, 0.5, 0.75],
}

/** Images live in frontend/public/emojidecode/. Answers stay server-side only. */
export const EMOJI_QUESTIONS: Array<{ image: string; answer: string }> = [
  { image: '/emojidecode/image1.png', answer: 'Cloud Storage' },
  { image: '/emojidecode/image2.png', answer: 'Two Factor Authentication' },
  { image: '/emojidecode/image3.png', answer: 'Phishing Attack' },
  { image: '/emojidecode/image4.png', answer: 'Debugging' },
  { image: '/emojidecode/image5.png', answer: 'Firewall' },
  { image: '/emojidecode/image6.png', answer: 'Zero Trust' },
  { image: '/emojidecode/image7.png', answer: 'CI CD Pipeline' },
]

function emojiQuestions(): QuestionDoc[] {
  return EMOJI_QUESTIONS.map((q, i) => ({
    _id: `r2q${i + 1}`,
    kind: 'emoji',
    prompt: 'What does this picture mean?',
    image: q.image,
    answerSeconds: EMOJI.answerSeconds,
    points: EMOJI.rankPoints[0],
    rankPoints: EMOJI.rankPoints,
    acceptedAnswers: [q.answer],
  }))
}

/** Compare answers by letters/digits only: "ci/cd pipeline" === "CI CD Pipeline". */
export function lettersOnly(value: string): string {
  return value.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * The blanks players see: one array per word, a letter where it's revealed and
 * null where it's still hidden. More letters appear as time runs out.
 * `progress` is 0..1 of the answer time; >= 1 reveals everything.
 */
export function emojiHint(answer: string, progress: number): Array<Array<string | null>> {
  const stage = progress >= 1 ? 99 : EMOJI.revealAt.filter((t) => progress >= t).length
  return answer.toUpperCase().split(/\s+/).filter(Boolean).map((word) => {
    const chars = [...word]
    const show = new Set<number>()
    if (stage >= 1) show.add(0)
    if (stage >= 2) show.add(chars.length - 1)
    if (stage >= 3) show.add(Math.floor((chars.length - 1) / 2))
    return chars.map((c, i) => (stage >= 99 || show.has(i) || !/[A-Z0-9]/.test(c) ? c : null))
  })
}

/** Draw & Guess timing + scoring. */
export const DRAW = {
  questions: 6,
  answerSeconds: 60,
  rankPoints: [5, 4, 3, 2, 1], // 1st..5th correct guesser
  maxStrokes: 400, // per team canvas per question
}

/** Easy-to-draw words; 6 are picked at random for each new game. */
export const DRAW_WORDS = [
  'DOG', 'CAT', 'AIRPLANE', 'HOUSE', 'TREE', 'SUN', 'CAR', 'FISH', 'PIZZA', 'BICYCLE',
  'UMBRELLA', 'ROCKET', 'GUITAR', 'ELEPHANT', 'BANANA', 'LAPTOP', 'CLOCK', 'SNOWMAN',
  'BUTTERFLY', 'CAMERA', 'GLASSES', 'MOUNTAIN', 'FLOWER', 'SPIDER', 'BALLOON', 'KEY',
  'TRAIN', 'BOOK', 'CUP', 'STAR', 'MOON', 'APPLE', 'CROWN', 'GHOST', 'TURTLE', 'ROBOT',
]

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function drawingQuestions(roundNo: number): QuestionDoc[] {
  return shuffle(DRAW_WORDS).slice(0, DRAW.questions).map((word, i) => ({
    _id: `r${roundNo}q${i + 1}`,
    kind: 'drawing',
    prompt: 'Draw & Guess',
    answerSeconds: DRAW.answerSeconds,
    points: DRAW.rankPoints[0],
    rankPoints: DRAW.rankPoints,
    acceptedAnswers: [word],
  }))
}

/** Technical Showdown timing + scoring. */
export const TECH = {
  answerSeconds: 30,
  rankPoints: [5, 3, 1], // 1st, 2nd, 3rd correct player
}

/** Options are listed A, B, C, D in order. `answer` must match one option exactly. */
export const TECH_QUESTIONS: Array<{ prompt: string; code?: string; options: string[]; answer: string }> = [
  {
    prompt: 'Which HTTP status code means "Not Found"?',
    options: ['200', '301', '404', '500'],
    answer: '404',
  },
  {
    prompt: 'Which department is returned by this SQL query?',
    code: [
      'Employees after WHERE salary > 50000:',
      '  Engineering : 70000',
      '  Engineering : 65000',
      '  HR          : 60000',
      '  Sales       : 75000',
      '',
      'SELECT department',
      'FROM employees',
      'WHERE salary > 50000',
      'GROUP BY department',
      'HAVING COUNT(*) >= 2;',
    ].join('\n'),
    options: ['Engineering only', 'HR only', 'Engineering and HR', 'Engineering and Sales'],
    answer: 'Engineering only',
  },
  {
    prompt: 'What is the network address of 192.168.10.77/26?',
    options: ['192.168.10.0/26', '192.168.10.64/26', '192.168.10.77/26', '192.168.10.128/26'],
    answer: '192.168.10.64/26',
  },
  {
    prompt: 'After running git reset --soft HEAD~1, what happens?',
    code: 'git reset --soft HEAD~1',
    options: [
      'The last commit is removed and its changes stay staged',
      'The last commit and changes are deleted',
      'The working tree is reset but the commit stays',
      'Only untracked files are removed',
    ],
    answer: 'The last commit is removed and its changes stay staged',
  },
  {
    prompt: 'Which request is idempotent by standard HTTP semantics?',
    options: [
      'POST /orders to create a new order',
      'PUT /users/42 with the full user representation',
      'POST /payments to charge a card',
      'PATCH /counter with "increment by 1"',
    ],
    answer: 'PUT /users/42 with the full user representation',
  },
  {
    prompt: 'A classifier has TP=42, FP=8, FN=18. What is its F1 score (approximately)?',
    options: ['70.0%', '76.4%', '84.0%', '91.3%'],
    answer: '76.4%',
  },
]

function techQuestions(roundNo: number): QuestionDoc[] {
  return TECH_QUESTIONS.map((q, i) => ({
    _id: `r${roundNo}q${i + 1}`,
    kind: 'mcq',
    prompt: q.prompt,
    code: q.code,
    options: q.options,
    answerSeconds: TECH.answerSeconds,
    points: TECH.rankPoints[0],
    rankPoints: TECH.rankPoints,
    acceptedAnswers: [q.answer],
  }))
}

function memoryQuestions(): QuestionDoc[] {
  return MEMORY_GRIDS.map((words, i) => ({
    _id: `r1q${i + 1}`,
    kind: 'memory',
    prompt: 'Remember as many words as you can!',
    words,
    rows: MEMORY.rows,
    cols: MEMORY.cols,
    showSeconds: MEMORY.showSeconds,
    answerSeconds: MEMORY.answerSeconds,
    points: MEMORY.pointsPerWord,
    acceptedAnswers: [],
  }))
}

/**
 * Bump this whenever the built-in rounds change. A lobby created with older
 * content is refreshed automatically (games already in progress are left alone).
 */
export const CONTENT_VERSION = 4

export function defaultRounds(): RoundDoc[] {
  return [
    {
      _id: '1',
      index: 0,
      name: 'Memory Grid',
      instructions: `A 5×5 grid of words appears for ${MEMORY.showSeconds} seconds, then hides. Type every word you remember — one per box — within ${MEMORY.answerSeconds} seconds. Each correctly spelled word earns ${MEMORY.pointsPerWord} point.`,
      questions: memoryQuestions(),
    },
    {
      _id: '2',
      index: 1,
      name: 'Emoji Decode',
      instructions: `Decode the picture in ${EMOJI.answerSeconds} seconds. Letters of the answer appear as time runs out. The first three players to get it right win ${EMOJI.rankPoints.join(' / ')} points. Wrong guesses are fine — keep trying.`,
      questions: emojiQuestions(),
    },
    {
      _id: '3',
      index: 2,
      name: 'Draw & Guess',
      instructions: `One artist from each team gets a secret word and has ${DRAW.answerSeconds} seconds to draw it. Everyone else guesses in the chat. The first five correct guessers win ${DRAW.rankPoints.join(' / ')} points.`,
      questions: drawingQuestions(3),
    },
    {
      _id: '4',
      index: 3,
      name: 'Technical Showdown',
      instructions: `Pick one answer within ${TECH.answerSeconds} seconds — you only get one try. The first three correct players win ${TECH.rankPoints.join(' / ')} points.`,
      questions: techQuestions(4),
    },
  ]
}

/** Words a player recalled that are on the grid: exact spelling, any case, each counted once. */
export function matchMemoryWords(answer: string, gridWords: string[]): string[] {
  const grid = new Set(gridWords.map((w) => w.trim().toUpperCase()))
  const seen = new Set<string>()
  for (const raw of answer.split(/[\n,]+/)) {
    const word = raw.trim().toUpperCase()
    if (word && grid.has(word)) seen.add(word)
  }
  return [...seen]
}
