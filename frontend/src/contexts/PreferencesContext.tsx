import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
export interface Preferences { theme: 'dark' | 'light'; sound: boolean; volume: number; reducedMotion: boolean; notifications: boolean }
const defaults: Preferences = { theme:'dark', sound:false, volume:65, reducedMotion:false, notifications:true }
export function readPreferences(): Preferences { try { return { ...defaults,...JSON.parse(localStorage.getItem('jumble.preferences') || '{}') } } catch { return defaults } }
const Context=createContext<{ preferences: Preferences; update: (patch:Partial<Preferences>)=>void } | null>(null)
export function PreferencesProvider({children}:{children:ReactNode}) {
  const [preferences,setPreferences]=useState(readPreferences)
  useEffect(()=>{ try{localStorage.setItem('jumble.preferences',JSON.stringify(preferences))}catch{}document.documentElement.dataset.theme=preferences.theme;document.documentElement.dataset.motion=preferences.reducedMotion?'reduced':'normal' },[preferences])
  return <Context.Provider value={{preferences,update:patch=>setPreferences(old=>({...old,...patch}))}}>{children}</Context.Provider>
}
export function usePreferences(){const value=useContext(Context);if(!value)throw new Error('Preferences provider is missing');return value}
