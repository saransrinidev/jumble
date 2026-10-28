import { defaultRounds } from '../../../../backend/src/lib/content'
import { getSession } from '../session'
import type { SavedGame, SavedRound } from '../dashboardService'
import * as engine from './engine'
export function library() {
  let templates: (SavedGame & { ownerId: string })[] = []
  try { templates = JSON.parse(localStorage.getItem('jumble.mock.templates') || '[]') } catch { /* empty library */ }
  return { templates, defaults: defaultRounds() }
}
export function userLibrary() { const l = library(); return { ...l, templates: l.templates.filter(t => t.ownerId === getSession()?.user.id) } }
export function saveTemplate(body: { id?: string; title: string; rounds: SavedRound[] }) {
  const l = library(), ownerId = getSession()!.user.id
  if (!body.title?.trim() || !Array.isArray(body.rounds) || !body.rounds.length || body.rounds.length>20) throw new Error('Enter a title and between one and twenty rounds.')
  if (body.id && !l.templates.some(t => t._id === body.id && t.ownerId === ownerId)) throw new Error('Saved game not found.')
  const template = { _id: body.id || crypto.randomUUID(), ownerId, title: body.title.trim(), rounds: body.rounds }
  localStorage.setItem('jumble.mock.templates', JSON.stringify([template, ...l.templates.filter(t => t._id !== template._id)]))
  return template
}
export function hostGame(body: { templateId?: string; replace?: boolean }) {
  const user = getSession()!.user
  if (engine.dashboard(user.id).active && !body.replace) throw new Error('A game is already open. Confirm replacement first.')
  const template = body.templateId ? userLibrary().templates.find(t => t._id === body.templateId) : null
  if (body.templateId && !template) throw new Error('Saved game not found.')
  const rounds = template?.rounds || defaultRounds()
  if (rounds.some(r => !r.questions.length || r.questions.some(q => !q.prompt.trim() || (q.kind === 'memory' ? !q.words?.length || q.words.length !== (q.rows || 5) * (q.cols || 5) : !q.acceptedAnswers.some(a => a.trim()))))) throw new Error('Complete each round and answer before hosting.')
  return engine.createGame(user, template?.title || 'Jumble', { version: 1, rounds: rounds.map(r => ({ name:r.name,gameType: r.questions[0].kind === 'mcq' ? 'technical' : r.questions[0].kind,
    questions: r.questions.map(q => ({ id: q._id, prompt: q.prompt, answerType: q.kind === 'mcq' ? 'mcq' : 'text', options: q.options || [], acceptedAnswers: q.kind === 'memory' ? q.words : q.acceptedAnswers, data: { cells: q.words, rows: q.rows, cols: q.cols, code: q.code, image: q.image, puzzle: q.prompt }, hard: false, memoryTime: q.showSeconds || 10, answerTime: q.answerSeconds, instructions: r.instructions })) })) })
}
