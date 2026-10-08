/** Print all players from MongoDB as a table (verification). Usage: npm run players */
import './loadenv'

import { COLLECTIONS, collection } from '../src/lib/mongo'
import { TEAM_DEFS } from '../src/lib/engine'
import type { PlayerDoc } from '../src/lib/types'

async function main() {
  const players = await collection<PlayerDoc>(COLLECTIONS.players)
  const all = await players.find({}).sort({ teamId: 1, _id: 1 }).toArray()
  const name = (id: string) => TEAM_DEFS.find((t) => t._id === id)?.name ?? id
  const rows = all.map((p) => ({ userId: p._id, name: p.name, team: name(p.teamId), joined: p.joined, score: p.score }))
  console.log(`TOTAL PLAYERS: ${rows.length}`)
  for (const t of TEAM_DEFS) console.log(`${t.name}: ${rows.filter((r) => r.team === t.name).length}`)
  console.table(rows)
  process.exit(0)
}
main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1) })
