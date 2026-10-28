import { createHash, randomBytes } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { collection } from './mongo'
import { AppError } from './envelope'
import { getGame, TEAM_DEFS } from './engine'
import type { PlayerDoc, GameDoc, RoundDoc } from './types'

export interface Identity { id: string; name: string }
export interface Result { _id: string; title: string; completedAt?: Date; players: number; host?: Identity; totalRounds?: number; teams: { id: string; name: string; score: number }[] }
const digest = (token: string) => createHash('sha256').update(token).digest('hex')
export async function login(identifier: string) {
  const player = await (await collection<PlayerDoc>('players')).findOne({ _id: identifier.trim().toUpperCase() })
  if (!player) throw new AppError('EMPLOYEE_NOT_FOUND', 'That user ID is not on the roster.', 404)
  const token = randomBytes(32).toString('hex')
  const user = { id: player._id, name: player.name }
  await (await collection<{ _id: string; user: Identity; expiresAt: Date }>('sessions')).insertOne({ _id: digest(token), user, expiresAt: new Date(Date.now() + 7 * 86400000) })
  return { token, user }
}
export async function requireUser(req: NextRequest): Promise<Identity> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  const session = await (await collection<{ _id: string; user: Identity; expiresAt: Date }>('sessions')).findOne({ _id: digest(token), expiresAt: { $gt: new Date() } })
  if (!session) throw new AppError('UNAUTHORIZED', 'Please log in with your user ID.', 401)
  return session.user
}
export async function saveResult(game: GameDoc) {
  if (game.status !== 'completed' || game.closedAt) return
  const players = await (await collection<PlayerDoc>('players')).find({ joined: true }).toArray()
  const result = { _id: game.sessionId || String(game.completedAt), title: game.title || 'Jumble', completedAt: game.completedAt, players: players.length, host:game.host,totalRounds:game.rounds.length,
    teams: TEAM_DEFS.map(team => ({ id: team._id, name: team.name, score: players.filter(p => p.teamId === team._id).reduce((sum, p) => sum + p.score, 0) })) }
  await (await collection<Result>('results')).updateOne({ _id: result._id }, { $setOnInsert: result }, { upsert: true })
}
export async function dashboard(user: Identity) {
  const game = await getGame()
  if (game?.status === 'completed') await saveResult(game)
  const last = await (await collection('results')).findOne({}, { sort: { completedAt: -1 } })
  const players=game?await (await collection<PlayerDoc>('players')).countDocuments({joined:true}):0
  return { active: game && game.status !== 'completed' ? { id: 'current', title: game.title || 'Jumble', status: game.status, host: game.host || null,players,rounds:game.rounds.map(r=>r.name) } : null,
    isHost: Boolean(game?.host?.id === user.id), last }
}
export interface Template { _id: string; ownerId: string; title: string; rounds: RoundDoc[]; updatedAt: Date }
