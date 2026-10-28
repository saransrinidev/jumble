import { request, post } from './api'
import type { User, Session } from './session'
export interface SavedQuestion { _id: string; kind: 'memory' | 'emoji' | 'drawing' | 'mcq' | 'text'; prompt: string; answerSeconds: number; points: number; acceptedAnswers: string[]; words?: string[]; rows?: number; cols?: number; showSeconds?: number; image?: string; rankPoints?: number[]; options?: string[]; code?: string }
export interface SavedRound { _id: string; index: number; name: string; instructions: string; kind?: SavedQuestion['kind']; questions: SavedQuestion[] }
export interface SavedGame { _id: string; title: string; rounds: SavedRound[] }
export interface GameResult { _id: string; title: string; completedAt: string; players: number; host?: User; totalRounds?: number; teams: { id: string; name: string; score: number }[] }
export interface DashboardData { active: { id: string; title: string; status: string; host: User | null; players?: number; rounds?: string[] } | null; isHost: boolean; last: GameResult | null }
export const dashboardService = {
  login: (identifier: string) => post<Session>('/api/session', { identifier }),
  get: () => request<DashboardData>('/api/dashboard'),
  history: () => request<GameResult[]>('/api/history'),
  library: () => request<{ templates: SavedGame[]; defaults: SavedRound[] }>('/api/templates'),
  save: (game: SavedGame) => post<SavedGame>('/api/templates', { id: game._id || undefined, title: game.title, rounds: game.rounds }),
  host: (templateId?: string, replace = false) => post<{ id: string }>('/api/host/game/create', { templateId, replace }),
  close: () => post('/api/host/game/close'),
}
