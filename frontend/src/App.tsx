import { useEffect } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Volume2, VolumeX, Maximize } from 'lucide-react'
import { MotionConfig } from 'framer-motion'
import { GameProvider, useGame } from './contexts/GameContext'
import { HubProvider } from './contexts/HubContext'
import { usePreferences } from './contexts/PreferencesContext'
import { getSession } from './services/session'
import { HostGuard } from './components/common/HostGuard'
import GamingShell from './components/gaming/GamingShell'
import { Notice } from './components/gaming/UI'
import GamingDashboard from './pages/GamingDashboard'
import GamingEntry from './pages/GamingEntry'
import GamingBuilder from './pages/GamingBuilder'
import GamingLobby from './pages/GamingLobby'
import GamingResults from './pages/GamingResults'
import GamingHistory from './pages/GamingHistory'
import { GamingProfile, GamingSettings } from './pages/GamingAccount'
import PlayerGamePage from './pages/PlayerGamePage'
import { useSound } from './hooks/useSound'
import './gameplay.css'
import './gaming.css'
import './gaming-integration.css'
import './arena.css'

export default function App() {
  const pathname=useLocation().pathname, {preferences}=usePreferences()
  const control=pathname.startsWith('/control')
  if(pathname==='/')return <div className="gaming-ui auth-surface"><GamingEntry/></div>
  if(pathname==='/login')return <div className="gaming-ui auth-surface"><GamingEntry login/></div>
  if(!getSession())return <Navigate to="/login" replace/>
  if(['/host','/host/','/control','/control/','/play'].includes(pathname))return <Navigate to="/dashboard" replace/>
  if(['/build','/control/content'].includes(pathname))return <Navigate to="/create" replace/>
  const layout=<GameProvider key={control?'host':'player'}><Layout/></GameProvider>
  return <MotionConfig reducedMotion={preferences.reducedMotion?'always':'user'}><div className="gaming-ui"><HubProvider>{control?<HostGuard>{layout}</HostGuard>:layout}</HubProvider></div></MotionConfig>
}
function Layout(){
 const location=useLocation(),navigate=useNavigate(),host=location.pathname.startsWith('/control'),{state,loading,error,connection}=useGame(),sound=useSound()
 const session=['/lobby','/game','/results','/control/lobby','/control/game','/control/results'].includes(location.pathname)
 useEffect(()=>{if(!session||loading||!state.id||(!host&&!state.player))return;const target=`${host?'/control':''}/${state.phase==='completed'?'results':state.phase==='lobby'?'lobby':'game'}`;if(location.pathname!==target)navigate(target,{replace:true})},[state.phase,state.id,state.player,host,session,loading,location.pathname,navigate])
 useEffect(()=>{if(state.phase==='countdown')sound.play('countdown');if(state.phase==='score_revealed')sound.play('score');if(state.phase==='completed'&&!state.endedReason)sound.play('winner')},[state.phase])
 const lobby=location.pathname.endsWith('/lobby'),results=location.pathname.includes('results')||location.pathname.includes('history'),playing=location.pathname.endsWith('/game')
 return <GamingShell theme={lobby?'lobby-shell':results?'results-shell':''}>{session&&error&&<Notice message={error}/>} {playing&&<div className="game-toolbar"><span role="status">{connection==='connected'?'Connected':connection==='reconnecting'?'Reconnecting…':'Game session'}</span><div className="button-row"><button className="icon-button" aria-label={sound.enabled?'Mute game sounds':'Enable game sounds'} onClick={sound.toggle}>{sound.enabled?<Volume2 size={18}/>:<VolumeX size={18}/>}</button><button className="icon-button" aria-label="Toggle full screen" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen().catch(()=>{})}}><Maximize size={18}/></button><Link className="text-link" to="/dashboard">Dashboard</Link></div></div>}{session&&loading?<p className="dialog-copy" role="status">Restoring your game…</p>:<Routes><Route path="/dashboard" element={<GamingDashboard/>}/><Route path="/create" element={<GamingBuilder/>}/><Route path="/games" element={<GamingBuilder library/>}/><Route path="/history" element={<GamingHistory/>}/><Route path="/history/:id" element={<GamingResults/>}/><Route path="/last-results" element={<GamingResults/>}/><Route path="/profile" element={<GamingProfile/>}/><Route path="/settings" element={<GamingSettings/>}/><Route path="/lobby" element={<GamingLobby/>}/><Route path="/control/lobby" element={<GamingLobby host/>}/><Route path="/game" element={<PlayerGamePage/>}/><Route path="/control/game" element={<PlayerGamePage host/>}/><Route path="/results" element={<GamingResults current/>}/><Route path="/control/results" element={<GamingResults current/>}/><Route path="*" element={<div className="empty-state"><h1>A little off track?</h1><Link className="btn primary" to="/dashboard">Back to dashboard</Link></div>}/></Routes>}</GamingShell>
}
