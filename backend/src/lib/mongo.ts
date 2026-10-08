/**
 * MongoDB connection using the serverless pattern: one client cached on the
 * global object and reused across hot reloads / warm Vercel invocations.
 *
 * Two safeguards:
 * - A FAILED connect is never cached; the next request retries.
 * - `mongodb+srv://` needs a DNS SRV/TXT lookup. Some networks/routers time
 *   out on those (querySrv/queryTxt ETIMEOUT). If that happens we switch Node's
 *   resolver to public DNS servers and retry once.
 */
import dns from 'node:dns'
import { MongoClient, type Db, type Collection, type Document } from 'mongodb'
import { settings } from './config'

declare global {
  // eslint-disable-next-line no-var
  var _jumbleMongo: Promise<MongoClient> | undefined
}

const FALLBACK_DNS = (process.env.MONGODB_DNS_SERVERS ?? '1.1.1.1,8.8.8.8')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function isSrvDnsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /query(Srv|Txt)|ETIMEOUT|ECONNREFUSED.*_mongodb|ENOTFOUND.*_mongodb/i.test(msg)
}

async function connect(): Promise<MongoClient> {
  const open = () =>
    new MongoClient(settings.MONGODB_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000 }).connect()
  try {
    return await open()
  } catch (err) {
    if (!isSrvDnsError(err) || FALLBACK_DNS.length === 0) throw err
    // Local DNS couldn't resolve the Atlas SRV record — retry via public DNS.
    dns.setServers(FALLBACK_DNS)
    return await open()
  }
}

function clientPromise(): Promise<MongoClient> {
  if (!settings.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Add it to the environment / .env.')
  }
  if (!global._jumbleMongo) {
    global._jumbleMongo = connect().catch((err) => {
      // Don't cache the failure: clear it so the next request reconnects.
      global._jumbleMongo = undefined
      throw err
    })
  }
  return global._jumbleMongo
}

export async function db(): Promise<Db> {
  const client = await clientPromise()
  return client.db(settings.MONGODB_DB)
}

export async function collection<T extends Document = Document>(name: string): Promise<Collection<T>> {
  return (await db()).collection<T>(name)
}

/** Collection names used by the game. */
export const COLLECTIONS = {
  teams: 'teams',
  players: 'players',
  game: 'game',
  rounds: 'rounds',
  answers: 'answers',
} as const
