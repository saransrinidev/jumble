import { useEffect, useState } from 'react'
import type { ReactNode, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { request, setHostPassword, clearHostPassword, getHostPassword, STATIC } from '../../services/api'
import { Brand, Button, ErrorNotice, Loading } from './UI'

export function HostGuard({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    const verify = async () => {
      // STATIC demo grants host access without a password.
      if (!STATIC && !getHostPassword()) { if (alive) { setAllowed(false); setChecking(false) } ; return }
      try { await request('/api/host/access'); if (alive) { setAllowed(true); setError('') } }
      catch { if (alive) { setAllowed(false); clearHostPassword() } }
      finally { if (alive) setChecking(false) }
    }
    void verify()
    return () => { alive = false }
  }, [])

  const signIn = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      setHostPassword(password)
      await request('/api/host/access')
      setAllowed(true)
    } catch {
      clearHostPassword()
      setError('Incorrect host password.')
    } finally { setBusy(false); setPassword('') }
  }

  if (checking) return <Loading label="Checking access…"/>
  if (allowed) return children
  return <div className="app"><header className="site-header"><Brand/></header><main className="center-page">
    <h1>Host access</h1><p>Enter the host password to open the control panel.</p>
    <form className="form-panel control-sign-in" onSubmit={signIn}>
      <label htmlFor="control-password">Host password</label>
      <div className="input-wrap"><input id="control-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/></div>
      {error && <ErrorNotice message={error}/>}<Button busy={busy} type="submit">Enter control panel</Button>
    </form>
    <Link to="/" className="back-link">Back to Home</Link>
  </main></div>
}
