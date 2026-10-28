import { useState } from 'react'
import { Link,Navigate,useNavigate } from 'react-router-dom'
import { ArrowRight,Lock,Sun,Moon,Zap,UserX,RefreshCw } from 'lucide-react'
import { art,Notice } from '../components/gaming/UI'
import { usePreferences } from '../contexts/PreferencesContext'
import { getSession,saveSession } from '../services/session'
import { dashboardService } from '../services/dashboardService'
import { ApiError } from '../services/api'

function NotOnRoster({id,onRetry}:{id:string;onRetry:()=>void}){
  return (
    <div className="login-layout">
      <div className="login-copy">
        <span className="eyebrow">OOPS — NOT FOUND</span>
        <h1>We don't recognise<br/>that ID.</h1>
        <p>The user ID <strong style={{color:'var(--text)'}}>{id}</strong> isn't on the player roster. Double-check with your host and try again.</p>
        <img className="login-mascot" src={art('mascot')} alt="Jumble game mascot"/>
      </div>
      <div className="login-form" style={{display:'flex',flexDirection:'column',gap:20,alignItems:'flex-start'}}>
        <span className="eyebrow"><UserX size={14}/>ID not found</span>
        <h2>Not on the roster</h2>
        <p style={{marginBottom:0}}>Make sure you're using the exact ID your host shared — it's usually a short code like <code style={{background:'var(--card)',padding:'2px 6px',borderRadius:5,fontSize:12}}>EMP042</code>.</p>
        <ul style={{paddingLeft:18,fontSize:12,color:'var(--muted)',lineHeight:2,margin:0}}>
          <li>Check for typos or extra spaces</li>
          <li>IDs are case-insensitive</li>
          <li>Ask your host to confirm your ID</li>
        </ul>
        <button className="btn primary full" onClick={onRetry} style={{marginTop:8}}>
          <RefreshCw size={15}/>Try a different ID
        </button>
        <span className="login-note"><Lock size={12}/>Contact your game host if you need help.</span>
      </div>
    </div>
  )
}

export default function GamingEntry({login=false}:{login?:boolean}){
 const {preferences,update}=usePreferences(),navigate=useNavigate()
 const [id,setId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notFound,setNotFound]=useState(false),[attemptedId,setAttemptedId]=useState('')
 if(login&&getSession())return <Navigate to="/dashboard" replace/>

 if(login&&notFound){
   return (
     <main className="entry">
       <header className="entry-header">
         <Link to="/" className="wordmark">jumble<span>✦</span></Link>
         <nav>
           <button className="btn quiet" onClick={()=>update({theme:preferences.theme==='light'?'dark':'light'})}>{preferences.theme==='light'?<Moon size={16}/>:<Sun size={16}/>} {preferences.theme==='light'?'Dark':'Light'} theme</button>
           <Link className="btn" to="/">Back to entry</Link>
         </nav>
       </header>
       <NotOnRoster id={attemptedId} onRetry={()=>{setNotFound(false);setError('');setId('')}}/>
       <p className="login-foot">Need help? Ask your game host for your player ID.</p>
     </main>
   )
 }
 const cards=[{name:'Technical',sub:'Think fast. Think together.',image:'technical'},{name:'Emoji Decode',sub:'Connect the little clues.',image:'emoji'},{name:'Jumble',sub:'Your next team tradition.',image:'mascot'},{name:'Draw & Guess',sub:'Make your mark.',image:'drawing'},{name:'Memory Grid',sub:'Keep your eyes on the prize.',image:'memory'}]
 return <main className="entry"><header className="entry-header"><Link to="/" className="wordmark">jumble<span>✦</span></Link><nav><button className="btn quiet" onClick={()=>update({theme:preferences.theme==='light'?'dark':'light'})}>{preferences.theme==='light'?<Moon size={16}/>:<Sun size={16}/>} {preferences.theme==='light'?'Dark':'Light'} theme</button><Link className="btn" to={login?'/':'/login'}>{login?'Back to entry':getSession()?'Dashboard':'Log in'}</Link></nav></header>{login?<><div className="login-layout"><div className="login-copy"><span className="eyebrow">GOOD PEOPLE. GREAT GAMES.</span><h1>Your team is<br/>one login away.</h1><p>A little memory. A little creativity. A whole lot of friendly rivalry. Ready to play your part?</p><img className="login-mascot" src={art('mascot')} alt="Jumble game mascot"/></div><form className="login-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{saveSession(await dashboardService.login(id.trim()));navigate('/dashboard',{replace:true})}catch(cause){if(cause instanceof ApiError&&cause.code==='EMPLOYEE_NOT_FOUND'){setAttemptedId(id.trim());setNotFound(true)}else{setError(cause instanceof Error?cause.message:'Unable to log in.')}}finally{setBusy(false)}}}><span className="eyebrow">WELCOME TO JUMBLE</span><h2>Let’s get you in.</h2><p>Use the user ID your team gave you.</p><label className="field">Your user ID<input required autoFocus autoComplete="username" maxLength={100} value={id} placeholder="e.g. GIPL042" onChange={e=>setId(e.target.value.toUpperCase())}/></label>{error&&<Notice message={error}/>}<button className="btn primary full" disabled={busy||!id.trim()}>{busy?'Logging in…':'Enter dashboard'}<ArrowRight size={16}/></button><span className="login-note"><Lock size={12}/>Your team is assigned. Just bring yourself.</span></form></div><p className="login-foot">Logging in opens your dashboard. You choose when to join a game.</p></>:<><img className="entry-float left" src={art('technical')} alt=""/><img className="entry-float right" src={art('knight')} alt=""/><section className="entry-body"><span className="entry-badge"><Zap size={14}/>Your people. Your rounds. One unforgettable showdown.</span><h1>A little rivalry.<br/><em>A lot of good times.</em></h1><p>Bring your people. Find your clever side.<br/>Live challenges. One team takes the crown.</p><div className="button-row"><Link className="btn primary" to={getSession()?'/dashboard':'/login'}>Let’s play<ArrowRight size={16}/></Link></div><span className="entry-sub">No downloads. No complicated setup. Just your team.</span><div className="fan" aria-label="Game rounds">{cards.map(c=><div className="fan-card" key={c.name}><h2>{c.name}</h2><p>{c.sub}</p><img src={art(c.image)} alt=""/></div>)}</div></section></>}</main>
}
