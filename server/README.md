# MemKarti — Online Multiplayer Server

Realtime server for playing MemKarti over the internet by **room code**.
Built with **Node + TypeScript + Express + Socket.IO**, designed to run on
**Render Free**.

## Key idea: zero game-logic duplication

The server does **not** reimplement any game rules. It re-exports and runs the
**exact same engine** the mobile app uses for offline/LAN play:

```
server/src/engine.ts  ──►  ../MemKarti-cloud/apps/mobile-v2/src/game/lanGame.ts
                           ../MemKarti-cloud/apps/mobile-v2/src/game/deck.ts
                           ../MemKarti-cloud/apps/mobile-v2/src/game/autoPlay.ts
```

`lanGame.ts` is a set of pure functions (`createLobby`, `addPlayer`,
`startRound`, `submitPick`, `castVote`, `viewForPlayer`, …) depending only on
`deck.ts` (pure data) — so it runs unchanged under Node. If the game rules
change in the app, the server picks them up automatically. We use
[`tsx`](https://github.com/privatenumber/tsx) to run the TypeScript directly,
so there is no separate build step and no chance of the two copies drifting.

## Architecture

- **In-memory rooms** (`src/rooms.ts`). Room state is lost on restart/redeploy —
  acceptable for the MVP.
- **Room code:** 5 characters from an unambiguous alphabet (no `0/O/1/I`).
- **Authoritative server:** each socket receives its **own** `ClientView`
  (`viewForPlayer`) so opponents' hands are never leaked — same model as LAN.
- **Disconnect:** the player is marked `offline` (kept mid-game so the
  scoreboard/turn order survives; removed if still in the lobby).
- **Auto-advance:** a server timer auto-plays for anyone who doesn't act before
  the per-room `pickSeconds` / `voteSeconds` expire (reuses `autoPlay.ts`), so a
  dropped player can't soft-lock the room.
- **Cleanup:** rooms that stay fully offline for **>10 minutes** are deleted.

## Socket.IO protocol

### Client → Server
| Event | Payload | Notes |
|---|---|---|
| `createRoom` | `{ nickname }` | creator becomes host (`playerId: "host"`) |
| `joinRoom` | `{ roomCode, nickname }` | lobby only |
| `leaveRoom` | `{ roomCode }` | |
| `playerReady` | `{ roomCode, ready }` | cosmetic readiness flag |
| `startGame` | `{ roomCode }` | host only, needs ≥2 players |
| `nextRound` | `{ roomCode }` | host advances from the reveal screen |
| `playCard` | `{ roomCode, cardId }` | pick phase |
| `castVote` | `{ roomCode, submissionId }` | vote phase *(added — the engine separates pick/vote)* |
| `updateSettings` | `{ roomCode, totalRounds?, pickSeconds?, voteSeconds? }` | host only, lobby |
| `sendChatMessage` | `{ roomCode, text }` | |

### Server → Client
| Event | Payload | Notes |
|---|---|---|
| `roomCreated` | `{ roomCode, playerId }` | |
| `roomJoined` | `{ roomCode, playerId }` | |
| `gameState` | `{ roomCode, view, players, isHost }` | per-player `ClientView` (covers lobby **and** in-game) |
| `roomUpdated` | `{ roomCode, players }` | lobby member list (online/ready/score) |
| `errorMessage` | `{ message }` | |

> The per-player `gameState.view` replaces the draft's separate
> `gameStarted` / `gameStateUpdated` events — sending one personalized view per
> socket avoids leaking hands and lets the app reuse `LanGameUI` directly.

## Run locally

```bash
cd server
npm install
npm run dev      # tsx watch, hot reload
# or
npm start        # tsx src/index.ts
```

Health check: `GET http://localhost:3000/health` → `{ "ok": true }`

## Deploy to Render (Free)

**Option A — Blueprint (recommended).** A [`render.yaml`](../render.yaml) lives
at the repo root. In Render: **New → Blueprint**, pick this repo, confirm. It
creates a free web service `memkarti-server` with:

- Root directory: `server`
- Build: `npm install`
- Start: `npm start`
- Health check: `/health`

**Option B — manual.** New → Web Service → connect the repo →
Root Directory `server`, Build `npm install`, Start `npm start`, Plan `Free`.

After the first deploy you get a public URL, e.g.
`https://memkarti-server.onrender.com`.

> **Free-tier note:** the service sleeps after ~15 min idle; the first request
> after sleeping takes ~30–50s (cold start). The app's connect timeout is set to
> 60s to tolerate this. For instant wake, move to Railway / Fly.io later — only
> the URL changes, not the code.

## Point the app at the server

The mobile app reads the server URL from an Expo public env var. Set it before
building the APK (e.g. in `apps/mobile-v2/.env` or the EAS/GitHub Actions env):

```
EXPO_PUBLIC_SERVER_URL=https://memkarti-server.onrender.com
```

If unset, the app falls back to `https://memkarti-server.onrender.com`.
