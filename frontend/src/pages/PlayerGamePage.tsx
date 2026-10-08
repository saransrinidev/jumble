import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, LockKeyhole, Hourglass } from 'lucide-react'
import { useGame } from '../contexts/GameContext'
import type { HostAction } from '../contexts/GameContext'
import { Button, ErrorNotice, Page, TeamBadge } from '../components/common/UI'
import { GameRenderer } from '../components/game/GameRenderer'
import { Timer } from '../components/game/Timer'
import { ScoreReveal } from '../components/game/ScoreReveal'
import { TeamLeaderboard } from '../components/game/TeamLeaderboard'
import { ROUND_RULES } from '../types/content'
import { contentService } from '../services/contentService'
import { post, query, STATIC } from '../services/api'
import type { DrawingStroke } from '../types/game'
import { useCountdown } from '../hooks/useCountdown'
import { AwardPanel } from '../components/host/HostAdmin'
import { GuessChat } from '../components/game/GuessChat'
import { DrawingCanvas } from '../components/game/DrawingCanvas'

export default function PlayerGamePage({ host = false }: { host?: boolean }) {
  const { state } = useGame(), team = state.teams.find(t => t.id === state.player?.teamId)
  if (!host && !state.player) return <Page className="center-page"><h2>First, find your team.</h2><Link to="/play" className="button primary">Join Game<ArrowRight size={18}/></Link></Page>
  return <Page className={`game-page ${host ? 'host-game' : 'player-game'}`}><div className="round-header"><div><span className="eyebrow">ROUND {state.round || 1} OF {state.totalRounds || 4}</span><h2>{state.roundName}</h2></div>{host ? <span className="host-label">HOST VIEW</span> : team && <TeamBadge name={team.name}/>}</div>
    <div className={host ? 'host-game-grid' : ''}><section className="game-panel">
      {(state.phase === 'intro' || state.phase === 'between') && <div className="round-intro"><span className="eyebrow">{state.phase === 'between' ? 'NEXT ROUND' : state.question?.isDemo ? 'DEMO · PRACTICE' : `QUESTION ${state.question?.number ?? 1} / ${state.question?.scoredCount ?? 6}`}</span><h1>{state.roundName}</h1><p>{state.question?.instructions || ROUND_RULES[state.round - 1]}</p>{state.question?.isDemo && <p>Practice awards 0 points and does not affect scores.</p>}{state.phase === 'between' && <TeamLeaderboard teams={state.teams}/>}<p>{state.question?.lockAfterAttempt ? 'Submit one answer per team.' : 'Answer before time runs out.'}</p>{host ? <HostControls/> : <span className="waiting-label">Waiting for the host to start.</span>}</div>}
      {(state.phase === 'active' || state.phase === 'ended') && <LiveQuestion key={state.question?.id} host={host}/>}
      {(state.phase === 'score_revealed' || state.phase === 'answer_revealed') && <>{state.question?.gameType === 'memory' && state.question.questionType === 'words' ? <MemoryReveal host={host}/> : <div className="question-answer"><span className="eyebrow">{state.question?.isDemo ? 'DEMO' : `QUESTION ${state.question?.number} / ${state.question?.scoredCount ?? 6}`} · ANSWER</span>{state.question?.questionType === 'fill' && state.question.questionData?.image && <img className="bank-visual reveal-visual" src={state.question.questionData.image} alt="Emoji puzzle"/>}<strong>{state.question?.correctAnswer}</strong>{state.question?.questionType === 'chat' && <DrawingReveal host={host}/>}{(state.question?.questionType === 'fill' || state.question?.questionType === 'chat' || (!STATIC && state.question?.questionType === 'mcq')) && <SolverFeed/>}</div>}{state.question?.isDemo ? <p className="content-success">Practice complete · 0 points. Scores are unchanged.</p> : <ScoreReveal host={host}/>}{host ? <HostControls/> : <p className="waiting-label">Your team score is up to date. Waiting for the next question.</p>}</>}
      {state.phase === 'lobby' && <div className="round-intro"><Hourglass size={45}/><h2>The fun starts soon.</h2><Link to={host ? '/control/lobby' : '/lobby'} className="button secondary">Back to Lobby</Link></div>}
    </section>{host && <HostPanel/>}</div>
  </Page>
}

function LiveQuestion({ host }: { host: boolean }) {
  const { state, submit, clockOffset, refresh } = useGame(), q = state.question, player = state.player
  const [answer, setAnswer] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const remaining = useCountdown(q?.startedAt, q?.durationSeconds ?? 30, clockOffset)
  const prep = q?.subphase === 'prepare', artist = q?.questionData?.isArtist, closed = state.phase !== 'active' || remaining === 0
  const send = async () => {
    if (busy || !answer.trim()) return
    setBusy(true); setError('')
    try {
      const result = await submit(answer.trim())
      if (q?.questionType === 'fill') {
        // Emoji Decode: keep the text after a wrong guess so it can be corrected.
        if (result?.correct) setMessage('')
        else setMessage('Not quite — try again!')
      } else {
        setAnswer('')
        setMessage(q?.questionType === 'words' ? 'Your words are in. Scores appear when the question closes.' : !STATIC ? 'Answer received. The host will check it.' : q?.lockAfterAttempt ? 'Team answer received and locked.' : 'Answer received. You may retry until your team solves the question.')
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to submit.') } finally { setBusy(false) }
  }
  // Memory Grid: send whatever has been typed when time is nearly up.
  const autoSent = useRef(false)
  useEffect(() => {
    if (host || q?.questionType !== 'words' || prep || autoSent.current || player?.hasSubmitted || state.phase !== 'active') return
    if (remaining !== null && remaining <= 1 && answer.trim()) { autoSent.current = true; void send() }
  }, [remaining, answer, prep, host, q?.questionType, player?.hasSubmitted, state.phase])
  const clearCanvas = async () => { if (!q || !player) return; await post('/api/player/question/' + encodeURIComponent(q.id) + '/stroke' + query({ game_id: state.id, player_id: player.id }), { clear: true }); await refresh() }
  const stroke = async (value: DrawingStroke) => { if (!q || !player) return; await post('/api/player/question/' + encodeURIComponent(q.id) + '/stroke' + query({ game_id: state.id, player_id: player.id }), value); await refresh() }
  if (!q) return <div className="submission-state"><h2>Waiting for the next challenge.</h2></div>
  return <div className="question-content"><div className="question-meta"><span className="eyebrow">{q.isDemo ? 'DEMO · PRACTICE' : `QUESTION ${q.number} / ${q.scoredCount ?? 6}`} · {q.durationSeconds} SEC {prep ? 'MEMORIZATION / PREPARATION' : 'ANSWERS'}</span><Timer/></div><h1>{q.question}</h1>{q.instructions && <p className="round-rule">{q.instructions}</p>}
    {(q.gameType === 'emoji' || q.gameType === 'drawing' || (!STATIC && q.questionType === 'mcq')) && <SolverFeed/>}
    {prep && remaining === 0 ? <p role="status">Opening the answering phase…</p> : <GameRenderer question={q} selected={answer} onSelect={v => { setAnswer(v); if (message) setMessage('') }} onSubmit={() => void send()} onClear={clearCanvas} disabled={busy || closed || (player?.hasSubmitted && !artist)} host={host} clockOffset={clockOffset} teamNames={Object.fromEntries(state.teams.map(t => [t.id, t.name]))} onStroke={stroke}/>}
    {host ? <HostControls/> : q.questionType === 'chat' ? <>{player?.hasSubmitted && <p className="content-success" role="status"><LockKeyhole size={18}/>{solvedMessage(state)}</p>}<GuessChat canGuess={!artist && !player?.hasSubmitted} closed={closed}/></> : player?.hasSubmitted ? <p className="content-success" role="status"><LockKeyhole size={18}/>{q.questionType === 'fill' ? solvedMessage(state) : !STATIC && q.questionType === 'mcq' ? (state.solvers?.some(s => s.isYou) ? solvedMessage(state) : 'Your answer is locked in. The correct answer is shown when the question closes.') : q.questionType === 'words' ? 'Your words are in. Scores appear when the question closes.' : !STATIC ? 'Your answer is in. The host is checking answers — scores appear when the round closes.' : 'Your team answer is locked. Results appear when the question closes.'}</p> : !prep && !artist && <><Button busy={busy} disabled={!answer.trim() || closed} onClick={() => void send()}>{q.questionType === 'words' ? 'Submit my words' : q.questionType === 'fill' ? 'Guess' : 'Submit answer'}<ArrowRight size={18}/></Button><p className="submit-note">{!STATIC && q.questionType === 'mcq' ? 'One answer only — choose carefully. The first three correct answers win 5 / 3 / 1 points.' : q.questionType === 'fill' ? 'Press Enter to guess. Wrong guesses are fine — keep trying until someone wins all three places.' : q.questionType === 'words' ? 'Your words are sent automatically when time runs out. Only correct spelling scores.' : !STATIC ? 'One answer per player — the host checks it.' : q.lockAfterAttempt ? 'One answer per team.' : 'Repeated attempts are allowed. Team marks count once.'}</p></>}
    {error && <ErrorNotice message={error}/>}<p role="status" className="small-text">{message}</p>
  </div>
}

function HostPanel() {
  const { state, refresh } = useGame(), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const review = async (id: string, correct: boolean) => { setBusy(true); setError(''); try { await contentService.review(state.id, id, correct); await refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Unable to review.') } finally { setBusy(false) } }
  const reassign = async (teamId: string, playerId: string) => { if (!playerId) return; setBusy(true); setError(''); try { await contentService.reassign(state.id, teamId, playerId); await refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Unable to select artist.') } finally { setBusy(false) } }
  return <aside className="submission-panel"><span className="eyebrow">HOST SCOREBOARD</span><h3>Every team. Every mark.</h3>{state.question?.hostAnswer && <p className="host-answer">HOST ONLY · Correct answer: <strong>{state.question.hostAnswer}</strong></p>}<div className="host-score-list">{state.teams.map(t => <div key={t.id}><TeamBadge name={t.name}/><strong>{t.score}</strong><small>{state.phase === 'score_revealed' ? `+${t.roundGain} this question` : `${t.submitted} players answered`}</small></div>)}</div>
    {state.question?.gameType === 'drawing' && state.phase === 'active' && <div className="artist-controls"><h4>Selected artists</h4>{state.teams.map(t => <label key={t.id}>{t.name}<select value={state.question?.questionData?.artists?.[t.id] ?? ''} disabled={busy} onChange={e => void reassign(t.id, e.target.value)}><option value="">Select artist</option>{state.participants?.filter(p => p.teamId === t.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>)}<p>Reassigning preserves the question deadline.</p></div>}
    {STATIC && ['active', 'score_revealed'].includes(state.phase) && ['text', 'output', 'mcq', 'expression'].includes(state.question?.questionType ?? '') && <div className="grading-review"><h4>Review text answers</h4><p>Corrections update both scorecards immediately.</p>{state.reviewSubmissions?.map(s => <div key={s.id}><strong>{state.participants?.find(p => p.id === s.playerId)?.name ?? 'Player'}</strong><pre>{s.answer}</pre><small>{s.elapsed.toFixed(1)} sec · {s.correct ? 'Correct' : 'Incorrect'}</small><button className="button secondary" disabled={busy || state.phase !== 'score_revealed' || !['text', 'output'].includes(state.question?.questionType ?? '')} onClick={() => void review(s.id, !s.correct)}>{s.correct ? 'Mark incorrect' : 'Accept answer'}</button></div>)}</div>}
    {!STATIC && ['intro', 'between'].includes(state.phase) && state.question?.questionType === 'text' && <RoundEditor/>}
    {!STATIC && ['intro', 'between'].includes(state.phase) && state.question?.questionType === 'mcq' && <p className="host-note">Technical Showdown · question {state.question.number} of {state.question.scoredCount}. The question and four options appear when you start; players have 30 seconds and one attempt. The first three correct answers win 5 / 3 / 1 points, and the question closes once all three places are taken. This is the final round — after the last question, click Finish Game to show the results.</p>}
    {!STATIC && ['intro', 'between'].includes(state.phase) && state.question?.gameType === 'drawing' && <p className="host-note">Draw & Guess · question {state.question.number} of {state.question.scoredCount}. When you start, one artist per team is picked at random (everyone gets a turn before anyone repeats) and sees the secret word. Each team guesses from its own artist’s canvas for 60 seconds. The first five correct guessers win 5 / 4 / 3 / 2 / 1 points; the question closes once all five places are taken. Your screen shows all three canvases but never the word. If you project it, every team can see every drawing.</p>}
    {!STATIC && ['intro', 'between'].includes(state.phase) && state.question?.gameType === 'emoji' && <p className="host-note">Emoji Decode · question {state.question.number} of {state.question.scoredCount}. The picture shows for 20 seconds with letter blanks; hint letters appear as time runs out. The first three correct players win 5 / 3 / 1 points, and the question closes automatically once all three places are taken.</p>}
    {!STATIC && ['intro', 'between'].includes(state.phase) && state.question?.gameType === 'memory' && <p className="host-note">Memory Grid · question {state.question.number} of {state.question.scoredCount}. Players see a 5×5 word grid for 5 seconds, then type what they remember for 15 seconds. Scoring is automatic: 1 point per correctly spelled word.</p>}
    {!STATIC && ['active', 'score_revealed', 'completed'].includes(state.phase) && <div className="grading-review live-review">
      <h4>Answers this round ({state.reviewSubmissions?.length ?? 0} / {state.joined})</h4>
      <p>{state.question?.questionType === 'mcq' ? 'Scored instantly: the first three correct answers get 5 / 3 / 1 points. Each player gets one attempt.' : state.question?.gameType === 'drawing' ? 'Scored instantly: the first five correct guessers get 5 / 4 / 3 / 2 / 1 points. Use Award points below to adjust.' : state.question?.gameType === 'emoji' ? 'Scored instantly: the first three correct players get 5 / 3 / 1 points. Use Award points below to adjust.' : state.question?.gameType === 'memory' ? 'Scored automatically when the question closes: 1 point per correctly spelled grid word. Use Award points below to adjust.' : `Mark each answer. Correct answers add ${state.question?.points ?? 20} points; you can change a mark at any time.`}</p>
      {!state.reviewSubmissions?.length && <p className="muted small-text">No answers yet — they appear here as players submit.</p>}
      {[...(state.reviewSubmissions ?? [])].sort((a, b) => a.elapsed - b.elapsed).map(s => {
        const person = state.participants?.find(p => p.id === s.playerId)
        const team = state.teams.find(t => t.id === s.teamId)
        if (s.kind === 'emoji' || s.kind === 'drawing' || s.kind === 'mcq') return <div key={s.id} className={`review-row ${s.correct ? 'is-correct' : ''}`}>
          <div className="review-who"><strong>{s.rank ? `${MEDAL[s.rank - 1] ?? ''} ` : ''}{person?.name ?? s.playerName ?? s.playerId}</strong>{team && <TeamBadge name={team.name}/>}</div>
          <pre>{s.answer || '—'}</pre>
          <small>{s.correct ? (s.rank ? `${PLACE[s.rank - 1]} place · +${s.awardedPoints ?? 0} points` : 'Correct, after the podium filled · 0 points') : 'Not solved yet'} · {s.attempts ?? 0} {s.attempts === 1 ? 'guess' : 'guesses'}</small>
        </div>
        if (s.kind === 'memory') return <div key={s.id} className={`review-row ${s.matchedCount ? 'is-correct' : ''}`}>
          <div className="review-who"><strong>{person?.name ?? s.playerName ?? s.playerId}</strong>{team && <TeamBadge name={team.name}/>}</div>
          <pre>{s.answer.split('\n').filter(Boolean).join(', ') || '—'}</pre>
          <small>{s.matchedCount ?? 0} correct {s.matchedCount === 1 ? 'word' : 'words'}{state.phase !== 'active' ? ` · +${s.awardedPoints ?? 0} points` : ' so far'}</small>
        </div>
        return <div key={s.id} className={`review-row ${s.awardedPoints ? 'is-correct' : ''}`}>
          <div className="review-who"><strong>{person?.name ?? s.playerName ?? s.playerId}</strong>{team && <TeamBadge name={team.name}/>}</div>
          <pre>{s.answer}</pre>
          <small>{s.elapsed.toFixed(1)} sec · {s.awardedPoints ? `+${s.awardedPoints} points` : 'not scored'}</small>
          <div className="review-actions">
            <button className="button primary" disabled={busy || Boolean(s.awardedPoints)} onClick={() => void review(s.id, true)}>✓ Correct</button>
            <button className="button secondary" disabled={busy || !s.awardedPoints} onClick={() => void review(s.id, false)}>✗ Wrong</button>
          </div>
        </div>
      })}
    </div>}
    {error && <ErrorNotice message={error}/>}<p className="submit-note">Marks update automatically after every question.</p>
    {!STATIC && <AwardPanel/>}
  </aside>
}

const PLACE = ['1st', '2nd', '3rd', '4th', '5th']
const MEDAL = ['🥇', '🥈', '🥉', '🏅', '🏅']

function solvedMessage(state: ReturnType<typeof useGame>['state']) {
  const me = state.solvers?.find(s => s.isYou)
  return me ? `You got it! ${PLACE[me.rank - 1] ?? `#${me.rank}`} place · +${me.points} points` : 'You got it! The podium was already full, so no points this time.'
}

/** Emoji Decode: who has already solved it, live, in finishing order. */
function SolverFeed() {
  const { state } = useGame()
  const solvers = state.solvers ?? [], total = state.placesTotal ?? 3
  return <div className="solver-feed" aria-live="polite">
    {Array.from({ length: total }, (_, i) => {
      const s = solvers[i], team = s ? state.teams.find(t => t.id === s.teamId) : undefined
      return <div key={i} className={`solver-slot ${s ? 'taken' : ''} ${s?.isYou ? 'you' : ''}`}>
        <span className="solver-medal">{MEDAL[i] ?? `#${i + 1}`}</span>
        {s ? <><strong>{s.isYou ? 'You' : s.name}</strong>{team && <TeamBadge name={team.name}/>}<span className="solver-points">+{s.points}</span></> : <span className="solver-open">Open · +{(state.placePoints ?? [5, 3, 1])[i] ?? 0} points</span>}
      </div>
    })}
    {solvers.length > 0 && !solvers.some(s => s.isYou) && state.phase === 'active' && <p className="solver-alert">{solvers[solvers.length - 1].name} already got it — {solvers.length < total ? 'hurry, places are still open!' : 'all places are taken.'}</p>}
  </div>
}

/** Draw & Guess reveal: the finished drawing(s). */
function DrawingReveal({ host }: { host: boolean }) {
  const { state } = useGame(), data = state.question?.questionData
  if (!data) return null
  if (!host) return data.strokes?.length ? <div className="reveal-canvas"><p className="small-text">{data.artistName ? `${data.artistName}’s drawing` : 'Your team’s drawing'}</p><DrawingCanvas strokes={data.strokes}/></div> : null
  const teams = Object.keys(data.artistNames ?? data.canvases ?? {})
  return <div className="host-canvases reveal-canvas">{teams.map(id => <div key={id}><p className="small-text">{state.teams.find(t => t.id === id)?.name}{data.artistNames?.[id] ? ` · ${data.artistNames[id]}` : ''}</p><DrawingCanvas strokes={data.canvases?.[id] ?? []}/></div>)}</div>
}

/** Memory Grid reveal: the grid's words, highlighting the ones this player recalled. */
function MemoryReveal({ host }: { host: boolean }) {
  const { state } = useGame(), q = state.question, player = state.player
  const words = (q?.correctAnswer ?? '').split(' · ').filter(Boolean)
  const mine = new Set((player?.answer ?? '').split('\n').map(w => w.trim().toUpperCase()).filter(Boolean))
  return <div className="question-answer memory-reveal">
    <span className="eyebrow">QUESTION {q?.number} / {q?.scoredCount} · THE WORDS WERE</span>
    {!host && player && <p className="recall-result">You spelled <b>{player.recallCorrect ?? 0}</b> of {words.length} words correctly · <b>+{player.earnedPoints ?? 0}</b> points</p>}
    <div className="word-chips">{words.map(w => <span key={w} className={!host && mine.has(w) ? 'got' : ''}>{w}</span>)}</div>
  </div>
}

/** Host sets this round's question before starting it (MongoDB backend only). */
function RoundEditor() {
  const { state, refresh } = useGame()
  const [prompt, setPrompt] = useState(state.question?.question ?? '')
  const [answer, setAnswer] = useState(state.question?.hostAnswer ?? '')
  const [points, setPoints] = useState(state.question?.points ?? 20)
  const [seconds, setSeconds] = useState(state.question?.durationSeconds ?? 60)
  const [busy, setBusy] = useState(false), [saved, setSaved] = useState(''), [error, setError] = useState('')
  // Reload the fields whenever the host moves to a different round.
  useEffect(() => {
    setPrompt(state.question?.question ?? ''); setAnswer(state.question?.hostAnswer ?? '')
    setPoints(state.question?.points ?? 20); setSeconds(state.question?.durationSeconds ?? 60); setSaved('')
  }, [state.question?.id])
  const save = async () => {
    setBusy(true); setError(''); setSaved('')
    try {
      await post('/api/host/round/config', { questionId: state.question?.id, roundId: state.roundId, prompt: prompt.trim(), acceptedAnswers: answer.split('|').map(a => a.trim()).filter(Boolean), points: Number(points) || 0, answerSeconds: Math.max(10, Number(seconds) || 60) })
      await refresh(); setSaved('Saved. Start the round when you’re ready.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save the round.') } finally { setBusy(false) }
  }
  return <div className="round-editor">
    <h4>Round {state.round} question</h4>
    <label>Question shown to players<textarea rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Type the question players will see"/></label>
    <label>Correct answer (optional — auto-marks matching answers; separate variants with |)<input value={answer} onChange={e => setAnswer(e.target.value)} placeholder="e.g. Paris | paris city"/></label>
    <div className="round-editor-row">
      <label>Points<input type="number" min={0} value={points} onChange={e => setPoints(Number(e.target.value))}/></label>
      <label>Seconds<input type="number" min={10} value={seconds} onChange={e => setSeconds(Number(e.target.value))}/></label>
    </div>
    {error && <ErrorNotice message={error}/>}
    <Button busy={busy} onClick={() => void save()}>Save round</Button>{saved && <p className="content-success">{saved}</p>}
  </div>
}

export function HostControls() {
  const { state, hostAction } = useGame(), [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => setError(''), [state.phase])
  const controls: Partial<Record<typeof state.phase, { label: string; action: HostAction }>> = {
    intro: { label: state.question?.isDemo ? 'Start Demo' : state.question?.number === 1 ? `Start Round ${state.round} · Question 1` : `Start Question ${state.question?.number ?? ''} of ${state.question?.scoredCount ?? ''}`, action: 'question' }, active: { label: 'Close Answers & Show Scores', action: 'end' },
    ended: { label: 'Show Scores', action: 'scores' }, answer_revealed: { label: 'Show Scores', action: 'scores' },
    score_revealed: { label: state.isLastQuestion ? 'Finish Game · Show Results' : state.question?.isDemo ? 'Continue · Start Round' : state.question?.number === state.question?.scoredCount ? 'End Round · See Standings' : `Next Question (${(state.question?.number ?? 0) + 1} of ${state.question?.scoredCount ?? ''})`, action: state.isLastQuestion ? 'finish' : 'next' },
    between: { label: `Start Round ${state.round}`, action: 'round' },
  }
  const current = controls[state.phase]
  const run = async () => { if (!current) return; setBusy(true); setError(''); try { await hostAction(current.action) } catch (e) { setError(e instanceof Error ? e.message : 'Unable to continue.') } finally { setBusy(false) } }
  return <div className="host-controls">{error && <ErrorNotice message={error}/>} {state.phase === 'active' && state.question?.gameType === 'connection' && <Button disabled={busy || (state.question.questionData?.clues?.length ?? 0) >= 4} onClick={() => { setBusy(true); void contentService.clue(state.id).catch(e => setError(e.message)).finally(() => setBusy(false)) }}>Reveal next clue</Button>} {current && <Button busy={busy} onClick={() => void run()}>{current.label}<ArrowRight size={20}/></Button>}<span className="submit-note">Timers close questions and award marks automatically.</span></div>
}
