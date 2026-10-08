/**
 * Seed the database with the real event roster:
 * - ensures the 3 teams,
 * - REPLACES all players with the roster in roster.ts,
 * - opens a fresh lobby game.
 * Idempotent (re-running resets players to the roster and scores to 0).
 *
 * Usage: npm run seed
 */
import './loadenv' // must be first: loads .env before any env-reading module

import { COLLECTIONS, collection } from '../src/lib/mongo'
import { TEAM_DEFS, createGame } from '../src/lib/engine'
import type { PlayerDoc, TeamDoc } from '../src/lib/types'
import { ROSTER } from './roster'

function teamName(teamId: string): string {
  return TEAM_DEFS.find((t) => t._id === teamId)?.name ?? teamId
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('seed: MONGODB_URI is not set. Create backend/.env from .env.example first.')
    process.exit(1)
  }

  // Teams
  const teams = await collection<TeamDoc>(COLLECTIONS.teams)
  for (const team of TEAM_DEFS) {
    await teams.updateOne({ _id: team._id }, { $set: team }, { upsert: true })
  }

  // Players: clear any existing (dummy) players, then insert the real roster.
  const players = await collection<PlayerDoc>(COLLECTIONS.players)
  await players.deleteMany({})
  const docs: PlayerDoc[] = ROSTER.map((r) => ({
    _id: r.id.toUpperCase(),
    name: r.name,
    teamId: r.teamId,
    score: 0,
    joined: false,
    createdAt: new Date(),
  }))
  await players.insertMany(docs)

  // Fresh lobby + clear previous answers.
  await createGame()

  // Indexes
  await players.createIndex({ teamId: 1 })
  await (await collection(COLLECTIONS.answers)).createIndex({ roundId: 1, playerId: 1 })

  // ---- Tabular view ----
  const all = await players.find({}).sort({ teamId: 1, _id: 1 }).toArray()
  const rows = all.map((p) => ({
    userId: p._id,
    name: p.name,
    team: teamName(p.teamId),
    score: p.score,
  }))

  console.log(`\nSeed complete — ${rows.length} players across ${TEAM_DEFS.length} teams.\n`)
  console.table(rows)

  const generated = ROSTER.filter((r) => r.generatedId)
  if (generated.length) {
    console.log('\nNote: these players had no code in the source list, so IDs were generated — share these:')
    for (const g of generated) console.log(`  ${g.name} (${teamName(g.teamId)}) -> ${g.id}`)
  }

  const counts = TEAM_DEFS.map((t) => `${t.name}: ${rows.filter((r) => r.team === t.name).length}`)
  console.log(`\nTeam counts -> ${counts.join('  |  ')}`)

  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
