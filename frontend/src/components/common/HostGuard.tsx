import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { dashboardService } from '../../services/dashboardService'
import { getSession } from '../../services/session'
import { ErrorNotice, Loading } from './UI'
export function HostGuard({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null), [error, setError] = useState('')
  useEffect(() => { let alive = true; dashboardService.get().then(d => { if (alive) setAllowed(d.isHost) }).catch(e => { if (alive) setError(e.message) }); return () => { alive = false } }, [])
  if (!getSession()) return <Navigate to="/login" replace/>
  if (error) return <main className="center-page"><ErrorNotice message={error}/><Link to="/dashboard">Back to dashboard</Link></main>
  if (allowed === null) return <Loading label="Checking your game…"/>
  return allowed ? children : <Navigate to="/dashboard" replace/>
}
