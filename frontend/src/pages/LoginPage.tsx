import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, UserRound } from 'lucide-react'
import { Brand, Button, ErrorNotice } from '../components/common/UI'
import { dashboardService } from '../services/dashboardService'
import { getSession, saveSession } from '../services/session'
import '../dashboard.css'
export default function LoginPage() {
  const navigate = useNavigate()
  const [id, setId] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  if (getSession()) return <Navigate to="/dashboard" replace/>
  return <main className="dashboard-login"><Brand/><section className="dashboard-login-card"><span className="eyebrow">WELCOME TO JUMBLE</span><h1>Your next team showdown starts here.</h1><p>Log in to see the latest winner, join your team, or host a game of your own.</p><form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { saveSession(await dashboardService.login(id.trim())); navigate('/dashboard', { replace: true }) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to log in.') } finally { setBusy(false) } }}><label htmlFor="dashboard-user">Your user ID</label><div className="input-wrap"><UserRound size={20}/><input id="dashboard-user" required autoFocus autoComplete="username" placeholder="e.g. GIPL042" maxLength={100} value={id} onChange={e => setId(e.target.value.toUpperCase())}/></div>{error && <ErrorNotice message={error}/>}<Button type="submit" busy={busy} disabled={!id.trim()}>Log in<ArrowRight size={18}/></Button></form></section></main>
}
