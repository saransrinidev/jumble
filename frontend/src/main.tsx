import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { STATIC } from './services/api'
import './index.css'
// In the static (no-backend) build, an in-browser auto-host advances the game
// and simulated opponents play, so a solo visitor can experience a full match.
if (STATIC) void import('./services/mock/autoHost').then(m => m.startAutoHost())
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { if (this.state.failed) return <main className="center-page"><h1>Let’s get you back in.</h1><p>Something unexpected happened. Your game session is saved.</p><button className="button primary" onClick={() => window.location.reload()}>Rejoin Game</button></main>; return this.props.children }
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><BrowserRouter><App/></BrowserRouter></ErrorBoundary></React.StrictMode>)
