import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Hammer, Radio, Trophy, Users } from 'lucide-react'
import { Page, Button, ErrorNotice } from '../../components/common/UI'
import { useGame } from '../../contexts/GameContext'
import './hostDashboard.css'

interface LastGame {
  id: string
  completedAt: string
  players: number
  teams: { id: string; name: string; score: number }[]
}

const lastGameKey = 'jumble.host.last-game'

function readLastGame(): LastGame | null {
  try {
    const value = JSON.parse(localStorage.getItem(lastGameKey) || 'null') as LastGame | null
    return value && Array.isArray(value.teams) ? value : null
  } catch {
    return null
  }
}

export default function HostHomePage() {
  const { state, hostAction } = useGame()
  const navigate = useNavigate()
  const [lastGame, setLastGame] = useState(readLastGame)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (state.phase !== 'completed' || !state.id || state.endedReason === 'replaced') return
    const result: LastGame = {
      id: state.id,
      completedAt: state.completedAt || new Date().toISOString(),
      players: state.total,
      teams: state.teams.map(team => ({ id: team.id, name: team.name, score: team.score })),
    }
    localStorage.setItem(lastGameKey, JSON.stringify(result))
    setLastGame(result)
  }, [state.phase, state.id, state.completedAt, state.endedReason, state.total, state.teams])

  const start = async (destination: 'host' | 'build') => {
    if (state.id && state.phase !== 'lobby' && state.phase !== 'completed' &&
      !window.confirm('A game is in progress. Start a new game and reset all scores?')) return
    setBusy(true)
    setError('')
    try {
      await hostAction('create')
      navigate(destination === 'build' ? '/control/content' : '/control/lobby')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create game.')
    } finally {
      setBusy(false)
    }
  }

  const currentPath = state.phase === 'completed' ? '/control/results' :
    state.phase === 'lobby' ? '/control/lobby' : '/control/game'
  const standings = [...(lastGame?.teams ?? [])].sort((a, b) => b.score - a.score)
  const topScore = standings[0]?.score
  const winners = standings.filter(team => team.score === topScore)

  return <Page className="host-dashboard">
    <header className="host-dashboard-header">
      <span className="eyebrow"><Radio size={15}/> HOST DASHBOARD</span>
      <h1>Game day starts here.</h1>
      <p>See the latest result, prepare the next challenge, and bring everyone into the lobby.</p>
    </header>

    {error && <ErrorNotice message={error}/>}

    <section className="host-dashboard-actions" aria-label="Game actions">
      <div className="host-dashboard-action">
        <Radio size={28} aria-hidden="true"/>
        <h2>Host a game</h2>
        <p>Create a game and open the lobby for your teams.</p>
        <Button onClick={() => void start('host')} busy={busy}>Host Game<ArrowRight size={18}/></Button>
      </div>
      <div className="host-dashboard-action">
        <Hammer size={28} aria-hidden="true"/>
        <h2>Build a game</h2>
        <p>Create a draft, add questions, and preview each round.</p>
        <Button onClick={() => void start('build')} busy={busy}>Build Game<ArrowRight size={18}/></Button>
      </div>
    </section>

    {state.id && <section className="host-dashboard-current" aria-label="Current game">
      <div><span className="eyebrow">CURRENT GAME</span><h2>{state.phase === 'completed' ? 'Final results are ready' : state.phase === 'lobby' ? 'Your lobby is open' : 'Game in progress'}</h2><p><Users size={17}/> {state.total} players · {state.teams.length} teams</p></div>
      <div className="host-dashboard-links"><Link className="button secondary" to={currentPath}>{state.phase === 'completed' ? 'View results' : 'Open game'}<ArrowRight size={18}/></Link>{state.phase === 'lobby' && <Link className="button quiet" to="/control/content">Edit game content</Link>}</div>
    </section>}

    <section className="host-dashboard-last" aria-labelledby="last-game-heading">
      <div className="host-dashboard-section-heading"><div><span className="eyebrow">RECENT RESULTS</span><h2 id="last-game-heading">Last game played</h2></div><Trophy size={30} aria-hidden="true"/></div>
      {lastGame ? <>
        <div className="host-dashboard-winner"><span>{winners.length > 1 ? 'Winning teams' : 'Winning team'}</span><strong>{winners.map(team => team.name).join(' & ')}</strong><p>{topScore?.toLocaleString()} points · {lastGame.players} players · {new Date(lastGame.completedAt).toLocaleDateString()}</p></div>
        <ol className="host-dashboard-standings">{standings.map((team, index) => <li key={team.id}><span>{index + 1}. {team.name}</span><strong>{team.score.toLocaleString()} pts</strong></li>)}</ol>
      </> : <p className="host-dashboard-empty">No completed game yet. Finish a game to see its winner and scores here.</p>}
    </section>
  </Page>
}
