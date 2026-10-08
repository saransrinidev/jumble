import { post, request, query } from './api'
import type { GameState } from '../types/game'
// Host APIs require a verified Supabase Auth access token, attached by api.ts.
const hostQuery = (gameId: string) => query({ game_id: gameId })
const questionAction = (action: string, gameId: string, questionId: string) => post('/api/host/question/' + encodeURIComponent(questionId) + '/' + action + hostQuery(gameId))
export const hostService = {
  createGame: () => post<{ id: string }>('/api/host/game/create', { title: 'Jumble' }),
  getHostLobby: (gameId: string) => request<Record<string, unknown>>('/api/host/lobby' + hostQuery(gameId)),
  getQuestionStatus: (gameId: string) => request<GameState>('/api/host/status' + hostQuery(gameId)),
  startGame: (gameId: string) => post('/api/host/game/start' + hostQuery(gameId)),
  startRound: (gameId: string, roundId: string) => post('/api/host/round/' + encodeURIComponent(roundId) + '/start' + hostQuery(gameId)),
  startQuestion: (gameId: string, questionId: string) => questionAction('start', gameId, questionId),
  endQuestion: (gameId: string, questionId: string) => questionAction('end', gameId, questionId),
  revealAnswer: (gameId: string, questionId: string) => questionAction('reveal-answer', gameId, questionId),
  revealScores: (gameId: string, questionId: string) => questionAction('reveal-score', gameId, questionId),
  nextQuestion: (gameId: string) => post('/api/host/game/next-question' + hostQuery(gameId)),
  completeRound: (gameId: string, roundId: string) => post('/api/host/round/' + encodeURIComponent(roundId) + '/complete' + hostQuery(gameId)),
  finishGame: (gameId: string) => post('/api/host/game/finish' + hostQuery(gameId)),
  replay: (gameId: string) => post<{ id: string }>('/api/host/game/replay' + hostQuery(gameId)),
  // Roster management (MongoDB backend).
  listPlayers: () => request<HostPlayer[]>('/api/host/players'),
  addPlayer: (userId: string, name: string, teamId: string) => post<HostPlayer>('/api/host/players', { userId, name, teamId }),
  removePlayer: (userId: string) => request('/api/host/players' + query({ user_id: userId }), { method: 'DELETE' }),
  // Manual scoring: add `points` (may be negative) to a player.
  award: (playerId: string, points: number) => post('/api/host/award', { playerId, points }),
  setScore: (playerId: string, score: number) => post('/api/host/award', { playerId, score }),
}
export interface HostPlayer { id: string; name: string; teamId: string; score: number; joined: boolean }
