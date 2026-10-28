import { useEffect,useState } from 'react'
import { getSession } from '../services/session'

export const profileCharacters=[
 {id:'mascot',name:'Jumble Buddy',description:'A little playful. A lot of personality.'},
 {id:'controller',name:'Pixel Pilot',description:'Always ready for another round.'},
 {id:'knight',name:'Royal Knight',description:'Big heart. Fearless spirit.'},
 {id:'cloud',name:'Cloud Cruiser',description:'Good vibes, wherever you play.'},
] as const
export type ProfileCharacter=typeof profileCharacters[number]['id']
export function readProfileCharacter(userId:string):ProfileCharacter{
 try{const value=JSON.parse(localStorage.getItem(`jumble.profile-character.${userId}`)||'null');return profileCharacters.some(c=>c.id===value)?value:'mascot'}catch{return 'mascot'}
}
export function useProfileCharacter(){
 const userId=getSession()?.user.id||'', [character,setValue]=useState<ProfileCharacter>(()=>readProfileCharacter(userId))
 useEffect(()=>{const sync=()=>setValue(readProfileCharacter(userId));sync();window.addEventListener('jumble-character',sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener('jumble-character',sync);window.removeEventListener('storage',sync)}},[userId])
 const setCharacter=(value:ProfileCharacter)=>{if(!profileCharacters.some(c=>c.id===value))return false;try{localStorage.setItem(`jumble.profile-character.${userId}`,JSON.stringify(value));setValue(value);window.dispatchEvent(new Event('jumble-character'));return true}catch{return false}}
 return {character,setCharacter}
}
