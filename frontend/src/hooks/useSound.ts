import { useRef } from 'react'
import { usePreferences } from '../contexts/PreferencesContext'
export function useSound() {
  const {preferences,update}=usePreferences()
  const audio=useRef<AudioContext|null>(null)
  const context=()=>{if(!audio.current)audio.current=new AudioContext();return audio.current}
  const toggle=()=>{try{void context().resume()}catch{}update({sound:!preferences.sound})}
  const play=(kind:'countdown'|'submit'|'correct'|'wrong'|'score'|'winner')=>{
    if(!preferences.sound||preferences.volume===0)return
    try{
      const ctx=context(),oscillator=ctx.createOscillator(),gain=ctx.createGain()
      oscillator.type='sine';oscillator.frequency.value={countdown:440,submit:550,correct:660,wrong:220,score:740,winner:880}[kind]
      gain.gain.setValueAtTime(0.045*preferences.volume/100,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.25)
      oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+0.25)
    }catch{}
  }
  return {enabled:preferences.sound,toggle,play}
}
