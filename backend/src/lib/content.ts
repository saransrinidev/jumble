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

function textQuestion(roundNo: number, prompt: string): QuestionDoc {
  return { _id: `r${roundNo}q1`, kind: 'text', prompt, answerSeconds: 60, points: 20, acceptedAnswers: [] }
}

export function defaultRounds(): RoundDoc[] {
  return [
    {
      _id: '1',
      index: 0,
      name: 'Memory Grid',
      instructions: `A 5×5 grid of words appears for ${MEMORY.showSeconds} seconds, then hides. Type every word you remember — one per box — within ${MEMORY.answerSeconds} seconds. Each correctly spelled word earns ${MEMORY.pointsPerWord} point.`,
      questions: memoryQuestions(),
    },
    { _id: '2', index: 1, name: 'Emoji Decode', instructions: 'Type your answer before time runs out. The host checks every answer.', questions: [textQuestion(2, 'Round 2 — decode the emoji puzzle.')] },
    { _id: '3', index: 2, name: 'Connection Hunt', instructions: 'Type your answer before time runs out. The host checks every answer.', questions: [textQuestion(3, 'Round 3 — find the connection.')] },
    { _id: '4', index: 3, name: 'Target Drop', instructions: 'Type your answer before time runs out. The host checks every answer.', questions: [textQuestion(4, 'Round 4 — hit the target number.')] },
    { _id: '5', index: 4, name: 'Draw & Guess', instructions: 'Type your answer before time runs out. The host checks every answer.', questions: [textQuestion(5, 'Round 5 — guess what your teammate draws.')] },
    { _id: '6', index: 5, name: 'Technical Showdown', instructions: 'Type your answer before time runs out. The host checks every answer.', questions: [textQuestion(6, 'Round 6 — the technical finale.')] },
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
