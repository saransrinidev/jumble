import { createContext,useContext,useEffect,useState,type ReactNode } from 'react'
import { useLocation,useNavigate } from 'react-router-dom'
import { dashboardService,type DashboardData,type SavedGame,type SavedRound } from '../services/dashboardService'
import { Modal,Notice } from '../components/gaming/UI'
import { ArrowRight } from 'lucide-react'
interface Hub { data:DashboardData|null; games:SavedGame[]; defaults:SavedRound[]; error:string; refresh:()=>Promise<void>; openHost:()=>void }
const Context=createContext<Hub|null>(null)
export function HubProvider({children}:{children:ReactNode}) {
 const [data,setData]=useState<DashboardData|null>(null),[games,setGames]=useState<SavedGame[]>([]),[defaults,setDefaults]=useState<SavedRound[]>([]),[error,setError]=useState('')
 const [hostOpen,setHostOpen]=useState(false),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[hostError,setHostError]=useState('')
 const location=useLocation(),navigate=useNavigate()
 const refresh=async()=>{const [d,l]=await Promise.all([dashboardService.get(),dashboardService.library()]);setData(d);setGames(l.templates);setDefaults(l.defaults);setError('')}
 useEffect(()=>{let alive=true;const load=()=>Promise.all([dashboardService.get(),dashboardService.library()]).then(([d,l])=>{if(alive){setData(d);setGames(l.templates);setDefaults(l.defaults);setError('')}}).catch(e=>{if(alive)setError(e.message)});void load();const timer=setInterval(()=>void load(),5000);return()=>{alive=false;clearInterval(timer)}},[location.pathname])
 useEffect(()=>{setHostOpen(false)},[location.pathname])
 return <Context.Provider value={{data,games,defaults,error,refresh,openHost:()=>{setHostError('');setHostOpen(true)}}}>{children}{hostOpen&&<Modal title="Bring everyone together." onClose={()=>{if(!busy)setHostOpen(false)}}><p className="dialog-copy">Choose your game. We’ll get the room ready.</p><form onSubmit={async e=>{e.preventDefault();if(data?.active&&!confirm('A game is already open. Replace it and reset its scores?'))return;setBusy(true);setHostError('');try{await dashboardService.host(selected||undefined,Boolean(data?.active));await refresh();setHostOpen(false);navigate('/control/lobby')}catch(cause){setHostError(cause instanceof Error?cause.message:'Unable to open the lobby.')}finally{setBusy(false)}}}><label className="field">Saved game<select value={selected} onChange={e=>setSelected(e.target.value)} aria-label="Saved game"><option value="">Jumble · ready-to-use questions</option>{games.map(g=><option key={g._id} value={g._id}>{g.title} · {g.rounds.length} rounds</option>)}</select></label>{hostError&&<Notice message={hostError}/>}<button className="btn primary full" disabled={busy}>{busy?'Opening lobby…':'Open lobby'}<ArrowRight size={16}/></button></form></Modal>}</Context.Provider>
}
export function useHub(){const value=useContext(Context);if(!value)throw new Error('Hub provider is missing');return value}
