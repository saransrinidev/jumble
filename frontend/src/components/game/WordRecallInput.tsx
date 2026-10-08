import { useEffect, useRef } from 'react'

interface Props {
  /** Maximum number of boxes (the number of words on the grid). */
  slots: number
  /** Newline-separated words. */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

/**
 * Memory Grid answer entry: one input box per word.
 * Enter/Space moves to the next box, Backspace on an empty box goes back,
 * and a fresh box appears as soon as the last one is filled.
 */
export function WordRecallInput({ slots, value, onChange, disabled }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const words = value ? value.split('\n') : []
  const filled = words.filter((w) => w.trim()).length
  const visible = Math.min(slots, Math.max(6, words.length + 1))

  // Typing time is short: put the cursor in the first box immediately.
  useEffect(() => { if (!disabled) refs.current[0]?.focus() }, [disabled])

  const setWord = (index: number, text: string) => {
    const next = [...words]
    while (next.length <= index) next.push('')
    next[index] = text.replace(/\s+/g, '').toUpperCase()
    while (next.length && !next[next.length - 1]) next.pop() // drop trailing empties
    onChange(next.join('\n'))
  }
  const focus = (index: number) => setTimeout(() => refs.current[index]?.focus(), 0)

  return <div className="word-recall">
    <div className="word-recall-grid">
      {Array.from({ length: visible }, (_, i) => <input
        key={i}
        ref={(el) => { refs.current[i] = el }}
        className="word-recall-box"
        aria-label={`Word ${i + 1}`}
        value={words[i] ?? ''}
        disabled={disabled}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={30}
        placeholder={`${i + 1}`}
        onChange={(e) => setWord(i, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focus(Math.min(i + 1, slots - 1)) }
          else if (e.key === 'Backspace' && !(words[i] ?? '') && i > 0) { e.preventDefault(); focus(i - 1) }
        }}
      />)}
    </div>
    <p className="word-recall-count" role="status">{filled} {filled === 1 ? 'word' : 'words'} entered · press Enter for the next box</p>
  </div>
}
