import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { useGame } from '../../contexts/GameContext'

const PLACE = ['1st', '2nd', '3rd', '4th', '5th']

/**
 * Draw & Guess team chat. Wrong guesses show for the whole team; a correct
 * guess shows as "guessed it!" without revealing the word.
 */
export function GuessChat({ canGuess, closed }: { canGuess: boolean; closed: boolean }) {
  const { state, submit } = useGame()
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [note, setNote] = useState('')
  const feed = useRef<HTMLOListElement>(null), input = useRef<HTMLInputElement>(null)
  const lines = state.chat ?? []
  useEffect(() => { feed.current?.scrollTo({ top: feed.current.scrollHeight }) }, [lines.length])
  useEffect(() => { if (canGuess && !closed) input.current?.focus() }, [canGuess, closed])

  const send = async () => {
    const guess = text.trim()
    if (!guess || busy) return
    setBusy(true); setNote('')
    try {
      const result = await submit(guess)
      setText('')
      if (result && !result.correct) setNote('Not it — keep guessing!')
    } catch (e) { setNote(e instanceof Error ? e.message : 'Unable to send.') }
    finally { setBusy(false); input.current?.focus() }
  }

  return <div className="guess-chat">
    <ol className="guess-feed" ref={feed} aria-live="polite" aria-label="Team guesses">
      {!lines.length && <li className="guess-empty">Guesses from your team appear here.</li>}
      {lines.map(l => <li key={l.id} className={`${l.correct ? 'guess-correct' : ''} ${l.isYou ? 'guess-mine' : ''}`}>
        <strong>{l.isYou ? 'You' : l.name}</strong>{l.correct ? <span> guessed it! {l.rank ? `${PLACE[l.rank - 1]} place ✓` : '✓'}</span> : <span>{l.text}</span>}
      </li>)}
    </ol>
    {canGuess && <form className="guess-form" onSubmit={e => { e.preventDefault(); void send() }}>
      <input ref={input} value={text} onChange={e => { setText(e.target.value); if (note) setNote('') }} disabled={closed || busy} maxLength={60} placeholder={closed ? 'Time’s up' : 'Type your guess…'} autoComplete="off" autoCorrect="off" spellCheck={false} aria-label="Your guess"/>
      <button type="submit" className="button primary" disabled={closed || busy || !text.trim()}><Send size={20}/>Send guess</button>
    </form>}
    {note && <p className="guess-note" role="status">{note}</p>}
  </div>
}
