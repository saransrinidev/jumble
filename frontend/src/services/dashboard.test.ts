import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) })
})
async function setup() {
  const { handleMockRequest } = await import('./mock/router')
  const call = async (path: string, body?: unknown) => {
    const response = await handleMockRequest(path, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) })
    return { status: response.status, ...await response.json() }
  }
  const login = async (id: string) => { const result = await call('/api/session', { identifier: id }); localStorage.setItem('jumble.session', JSON.stringify(result.data)) }
  return { call, login }
}
describe('dashboard and hosting', () => {
  it('creates a selected-round custom quiz before hosting and keeps its round name',async()=>{
    const {call,login}=await setup();await login('CREATOR')
    const rounds=[{_id:'movie',index:0,name:'Movie Trivia',kind:'text',instructions:'Guess the movie.',questions:[{_id:'movie1',kind:'text',prompt:'Which movie has Simba?',acceptedAnswers:['The Lion King'],answerSeconds:30,points:10}]}]
    const saved=await call('/api/templates',{title:'Movie night',rounds})
    expect(saved.success).toBe(true)
    expect((await call('/api/host/game/create',{templateId:saved.data._id})).success).toBe(true)
    expect((await call('/api/dashboard')).data.active.rounds).toEqual(['Movie Trivia'])
    const engine=await import('./mock/engine');engine.startGame()
    expect(engine.gameSnapshot(true).roundName).toBe('Movie Trivia')
    expect(engine.gameSnapshot(true).totalRounds).toBe(1)
  })
  it('soft-closes a lobby without creating a completed result',async()=>{
    const {call,login}=await setup();await login('HOST');await call('/api/host/game/create',{})
    const id=(await call('/api/dashboard')).data.active.id
    expect((await call('/api/host/game/close',{})).success).toBe(true)
    expect((await call('/api/dashboard')).data.active).toBeNull()
    const preserved=JSON.parse(localStorage.getItem('jumble.mock.v1')||'{}')
    expect(preserved.gameId).toBe(id);expect(preserved.endedReason).toBe('closed');expect(preserved.content.rounds.length).toBeGreaterThan(0)
    expect((await call('/api/history')).data).toEqual([])
  })
  it('allows only the current host to manage teams',async()=>{
    const {call,login}=await setup();await login('HOST');await call('/api/host/game/create',{})
    const result=await call('/api/host/players',{userId:'NEW',name:'New Player',teamId:'titans'})
    expect(result.data.teamId).toBe('titans')
    await login('OTHER');expect((await call('/api/host/players',{userId:'NEW',teamId:'vibe-tribe'})).status).toBe(403)
  })
  it('logs in without creating or joining a game and requires login for hosting', async () => {
    const { call, login } = await setup()
    expect((await call('/api/host/game/create', {})).status).toBe(401)
    await login('GIPL042')
    const dashboard = (await call('/api/dashboard')).data
    expect(dashboard.active).toBeNull()
    expect(dashboard.isHost).toBe(false)
    expect(localStorage.getItem('jumble.player')).toBeNull()
  })
  it('allows anyone to host but protects current-game controls from other users', async () => {
    const { call, login } = await setup()
    await login('FIRST')
    expect((await call('/api/host/game/create', {})).success).toBe(true)
    expect((await call('/api/dashboard')).data.active.host.id).toBe('FIRST')
    await login('SECOND')
    expect((await call('/api/dashboard')).data.isHost).toBe(false)
    expect((await call('/api/host/game/start', {})).status).toBe(403)
    expect((await call('/api/templates', {})).status).toBe(422)
    expect((await call('/api/host/game/create', {})).success).toBe(false)
    expect((await call('/api/host/game/create', { replace: true })).success).toBe(true)
    expect((await call('/api/dashboard')).data.active.host.id).toBe('SECOND')
  })
  it('saves drafts separately and snapshots saved content when hosting', async () => {
    const { call, login } = await setup()
    await login('HOST')
    await call('/api/host/game/create', {})
    const library = (await call('/api/templates')).data
    const original = (await call('/api/host/game/content')).data
    library.defaults[0].questions[0].prompt = 'A saved custom question'
    const saved = await call('/api/templates', { title: 'Friday challenge', rounds: library.defaults })
    expect(saved.success).toBe(true)
    expect((await call('/api/host/game/content')).data).toEqual(original)
    await call('/api/host/game/create', { templateId: saved.data._id, replace: true })
    expect((await call('/api/dashboard')).data.active.title).toBe('Friday challenge')
    const launched = (await call('/api/host/game/content')).data
    expect(launched.rounds[0].questions[0].prompt).toBe('A saved custom question')
    saved.data.rounds[0].questions[0].prompt = 'Changed later'
    await call('/api/templates', { ...saved.data, id: saved.data._id })
    expect((await call('/api/host/game/content')).data).toEqual(launched)
  })
  it('preserves the latest completed result after a new game opens', async () => {
    const { call, login } = await setup()
    await login('HOST')
    await call('/api/host/game/create', {})
    const engine = await import('./mock/engine')
    engine.startGame()
    for (let i = 0; i < 200; i++) {
      const snap = engine.gameSnapshot(true)
      if (snap.phase === 'completed') break
      if (snap.phase === 'intro') engine.hostAction('question')
      else if (snap.phase === 'active') engine.hostAction('scores')
      else if (snap.phase === 'between') engine.hostAction('round')
      else engine.hostAction('next')
    }
    const completed = (await call('/api/dashboard')).data
    expect(completed.active).toBeNull()
    expect(completed.last.teams).toHaveLength(3)
    await call('/api/host/game/create', {})
    expect((await call('/api/dashboard')).data.last).toEqual(completed.last)
  })
})
