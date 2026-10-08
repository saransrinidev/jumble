# Jumble backend (Next.js + MongoDB)

A real multiplayer backend for the Jumble game. Players join with a **user ID
the host issues**, submit answers that are tracked in MongoDB, and the host runs
the game and awards points from the control panel. Team totals are shown at the
end. Built as standard Next.js API routes so it deploys to **Vercel**; live
updates use **polling** (no websockets).

## Data model (MongoDB collections)

- `teams` — the three fixed teams.
- `players` — `_id` is the user ID (e.g. `GIPL031`), with `name`, `teamId`, `score`, `joined`.
- `game` — a single document (`_id: 'current'`) with status, phase, round index, and the six rounds.
- `answers` — one per player per round: text, correctness, awarded points.

## Local setup

1. Copy `.env.example` to `.env` and fill in:
   - `MONGODB_URI` — your Atlas connection string (backend only; never in the frontend)
   - `MONGODB_DB` — database name (default `jumble`)
   - `HOST_PASSWORD` — the password the host types at `/control`
   - `FRONTEND_URL` — the frontend origin (for CORS)
2. Install, seed, and run:

   ```powershell
   cd backend
   npm install
   npm run seed      # creates teams + sample players GIPL031..036 + a lobby
   npm run dev       # http://localhost:8000
   ```

`GET /health` reports the DB status.

## How a game runs

1. Host opens `/control`, enters `HOST_PASSWORD`.
2. Host adds players (user ID + team) in the lobby panel, or runs `npm run seed`.
3. Players open the app and join with their user ID.
4. Host starts the game and runs each round: start question → players submit →
   reveal (auto-scores correct answers for that round) → next round.
5. The host can adjust any player's points manually from the Award panel.
6. After the last round, team totals are shown.

### Scoring

When a round is revealed, each correct answer earns that round's `points`
(configurable per round via `POST /api/host/round/config`). Correctness is a
case-insensitive match against the round's `acceptedAnswers`. The host can also
add/subtract points per player at any time (`POST /api/host/award`). A team's
total is the sum of its players' scores.

## Deploy to Vercel

1. Create a Vercel project with the `backend/` directory as the root.
2. Add Environment Variables: `MONGODB_URI`, `MONGODB_DB`, `HOST_PASSWORD`,
   `FRONTEND_URL` (your deployed frontend origin), `ENVIRONMENT=production`.
3. In MongoDB Atlas, allow network access from Vercel (either allow `0.0.0.0/0`
   or Vercel's egress IPs) under Network Access.
4. Deploy. Run the seed once against the production DB (locally with the prod
   `MONGODB_URI`, or add a one-off script) to create teams and the lobby.
5. Deploy the frontend separately; set its `VITE_API_URL` to this backend's URL
   and `VITE_STATIC=false`.

## Routes

Player: `GET /api/game/active`, `GET /api/game/state`, `POST /api/player/join`,
`GET /api/player/state`, `GET /api/player/live`,
`POST /api/player/question/{roundId}/submit`.

Host (send `Authorization: Bearer <HOST_PASSWORD>`):
`GET /api/host/access`, `GET /api/host/live|lobby|status`,
`GET|POST|DELETE /api/host/players`, `POST /api/host/award`,
`POST /api/host/round/config`, `POST /api/host/game/{create,start,next-question,finish}`,
`POST /api/host/round/{id}/{start|complete}`,
`POST /api/host/question/{id}/{start|end|reveal-answer|reveal-score}`.

> Security: the host password and `MONGODB_URI` live only in the backend
> environment. Rotate the Atlas password if it was ever shared.
