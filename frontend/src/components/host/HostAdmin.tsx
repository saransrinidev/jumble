import { useCallback, useEffect, useState } from 'react'
import { UserPlus, Trash2, RefreshCw } from 'lucide-react'
import { hostService, type HostPlayer } from '../../services/hostService'
import { useGame } from '../../contexts/GameContext'
import { ErrorNotice } from '../common/UI'

const TEAMS = [
  { id: 'ctrl-alt-defeat', name: 'Ctrl Alt Defeat' },
  { id: 'titans', name: 'Titans' },
  { id: 'vibe-tribe', name: 'Vibe Tribe' },
]

/** Host roster manager: add players by user ID, assign team, remove, see joined status. */
export function PlayerManager() {
  const [players, setPlayers] = useState<HostPlayer[]>([])
  const [userId, setUserId] = useState('')
  const [name, setName] = useState('')
  const [teamId, setTeamId] = useState(TEAMS[0].id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setPlayers(await hostService.listPlayers()); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load players.') }
  }, [])
  useEffect(() => { void load() }, [load])

  const add = async () => {
    if (!userId.trim()) return
    setBusy(true); setError('')
    try {
      await hostService.addPlayer(userId.trim().toUpperCase(), name.trim(), teamId)
      setUserId(''); setName('')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to add player.') }
    finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    setBusy(true); setError('')
    try { await hostService.removePlayer(id); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to remove player.') }
    finally { setBusy(false) }
  }

  return <section className="host-admin-panel">
    <div className="host-admin-head"><h3>Players ({players.length})</h3><button className="icon-button" aria-label="Refresh players" onClick={() => void load()}><RefreshCw size={18}/></button></div>
    <div className="host-admin-add">
      <input placeholder="User ID (e.g. GIPL031)" value={userId} onChange={e => setUserId(e.target.value)} />
      <input placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)} />
      <select value={teamId} onChange={e => setTeamId(e.target.value)}>{TEAMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      <button className="button primary" disabled={busy} onClick={() => void add()}><UserPlus size={16}/> Add</button>
    </div>
    {error && <ErrorNotice message={error}/>}
    <ul className="host-admin-list">
      {TEAMS.map(team => <li key={team.id} className="host-admin-team">
        <strong>{team.name}</strong>
        <ul>{players.filter(p => p.teamId === team.id).map(p => <li key={p.id}>
          <span className="host-admin-id">{p.id}</span>
          <span className="host-admin-name">{p.name}</span>
          <span className={`host-admin-dot ${p.joined ? 'on' : ''}`} title={p.joined ? 'Joined' : 'Not joined'} />
          <span className="host-admin-score">{p.score}</span>
          <button className="icon-button" aria-label={`Remove ${p.id}`} disabled={busy} onClick={() => void remove(p.id)}><Trash2 size={16}/></button>
        </li>)}</ul>
      </li>)}
    </ul>
  </section>
}

/** Per-player point awarding, grouped by team. Shows name + team as requested. */
export function AwardPanel() {
  const { state, refresh } = useGame()
  const [players, setPlayers] = useState<HostPlayer[]>([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setPlayers(await hostService.listPlayers()); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load players.') }
  }, [])
  useEffect(() => { void load() }, [load, state.phase, state.round])

  const award = async (id: string, points: number) => {
    setBusy(id); setError('')
    try { await hostService.award(id, points); await load(); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to award points.') }
    finally { setBusy('') }
  }

  return <section className="host-admin-panel award-panel">
    <div className="host-admin-head"><h3>Award points</h3><button className="icon-button" aria-label="Refresh" onClick={() => void load()}><RefreshCw size={18}/></button></div>
    <p className="muted small-text">Points auto-add for correct answers each round. Adjust manually here if needed.</p>
    {error && <ErrorNotice message={error}/>}
    {TEAMS.map(team => <div key={team.id} className="award-team">
      <strong>{team.name}</strong>
      {players.filter(p => p.teamId === team.id).map(p => <div key={p.id} className="award-row">
        <span className="host-admin-name">{p.name}</span>
        <span className="host-admin-id">{p.id}</span>
        <span className="award-score">{p.score}</span>
        <span className="award-buttons">
          <button className="button secondary" disabled={busy === p.id} onClick={() => void award(p.id, -5)}>-5</button>
          <button className="button secondary" disabled={busy === p.id} onClick={() => void award(p.id, 5)}>+5</button>
          <button className="button primary" disabled={busy === p.id} onClick={() => void award(p.id, 10)}>+10</button>
        </span>
      </div>)}
    </div>)}
  </section>
}
