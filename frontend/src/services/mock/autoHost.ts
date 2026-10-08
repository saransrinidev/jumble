// Auto-host driver for the static (no-backend) build. A solo player does not
// need to open /control: this timer advances the game through its phases and
// nudges the simulated opponents to answer. It is a no-op once the game ends.
import * as engine from './engine'

let timer: ReturnType<typeof setInterval> | null = null
let phaseSince = 0

const INTRO_SECONDS = 3
const BETWEEN_SECONDS = 4
const REVEAL_SECONDS = 6

function tick() {
  if (!engine.hasActiveSession()) return
  const snap = (() => {
    try {
      return engine.gameSnapshot(true, null)
    } catch {
      return null
    }
  })()
  if (!snap) return

  const now = Date.now() / 1000
  const phase: string = snap.phase

  // Let bots submit while a question is active.
  if (phase === 'active') {
    engine.simulateBots()
  }

  if (phase !== lastPhase) {
    lastPhase = phase
    phaseSince = now
  }
  const inPhase = now - phaseSince

  try {
    if (snap.status === 'lobby') {
      // Auto-start shortly after the human has joined.
      if (inPhase > 2) engine.startGame()
    } else if (phase === 'intro') {
      if (inPhase > INTRO_SECONDS) engine.hostAction('question')
    } else if (phase === 'between') {
      if (inPhase > BETWEEN_SECONDS) engine.hostAction('round')
    } else if (phase === 'active') {
      // Close once the deadline passes (engine also lazily expires).
      if (snap.question?.deadline && now >= Date.parse(snap.question.deadline) / 1000) {
        engine.hostAction('scores')
      }
    } else if (phase === 'score_revealed') {
      if (inPhase > REVEAL_SECONDS) engine.hostAction(snap.isLastQuestion ? 'finish' : 'next')
    }
  } catch {
    /* phase race; retry next tick */
  }
}

let lastPhase = ''

export function startAutoHost() {
  if (timer) return
  phaseSince = Date.now() / 1000
  timer = setInterval(tick, 1000)
}

export function stopAutoHost() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
