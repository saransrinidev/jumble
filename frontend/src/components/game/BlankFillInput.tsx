import { useEffect, useRef } from 'react'

interface Props {
  /** One array per word: a letter where revealed, null where hidden. */
  pattern: Array<Array<string | null>>
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  disabled?: boolean
}

/**
 * Emoji Decode answer entry. Shows the answer as letter tiles (one group per
 * word). Hint letters appear as time runs out; what the player types fills the
 * tiles in order. Spaces and punctuation don't matter when checking.
 */
export function BlankFillInput({ pattern, value, onChange, onSubmit, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (!disabled) input.current?.focus() }, [disabled])
  const typed = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const total = pattern.reduce((n, w) => n + w.length, 0)

  let cursor = 0
  return <div className="blank-fill">
    <div className="blank-fill-words" aria-hidden="true" onClick={() => input.current?.focus()}>
      {pattern.map((word, w) => <div className="blank-fill-word" key={w}>
        {word.map((hint, i) => {
          const index = cursor++
          const mine = typed[index]
          return <span key={i} className={`blank-tile ${mine ? 'typed' : hint ? 'hint' : ''} ${index === typed.length && !disabled ? 'next' : ''}`}>{mine ?? hint ?? ''}</span>
        })}
      </div>)}
    </div>
    <p className="blank-fill-meta">{pattern.map((w) => w.length).join(' + ')} letters · hint letters appear as time runs out</p>
    <div className="blank-fill-entry">
      <input
        ref={input}
        className="answer-input blank-fill-input"
        aria-label="Your answer"
        value={value}
        disabled={disabled}
        maxLength={total + 20}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="Type the answer…"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) { e.preventDefault(); onSubmit?.() } }}
      />
    </div>
  </div>
}
