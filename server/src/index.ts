// ============================================================================
// MemKarti online multiplayer server.
// ----------------------------------------------------------------------------
// Express (health checks) + Socket.IO (realtime rooms). All game rules come
// from the shared engine (./engine -> apps/mobile-v2/src/game/lanGame.ts).
//
// Per-player state: every socket receives its OWN ClientView (via viewForPlayer)
// so hands are never leaked to opponents — identical to the LAN transport.
// ============================================================================

import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server, type Socket } from 'socket.io';
import { RoomManager, HOST_ID, type Room } from './rooms';
import { botsSubmit, botsVote } from './engine';
import { loadFlags, addFlag, setFlagOnce, removeFlags, allFlags, flaggedIds, summary, toCsv } from './qa';

const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(cors());
app.use(express.json());

const manager = new RoomManager();

// --- health / info endpoints (Render pings these, friends can sanity-check) --
app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'memkarti-server', rooms: manager.roomCount });
});
app.get('/health', (_req, res) => res.json({ ok: true }));

// --- QA: bad-meme flags (curation feedback from the app) --------------------
loadFlags();

app.post('/qa/flag', (req, res) => {
  const b = req.body ?? {};
  if (typeof b.memeId !== 'number') {
    return res.status(400).json({ error: 'memeId (number) is required' });
  }
  // From the review screen we don't want duplicate spam; in-game flags append.
  const fn = b.by === 'review' ? setFlagOnce : addFlag;
  const rec = fn({
    memeId: b.memeId,
    title: b.title,
    imageUrl: b.imageUrl,
    phase: b.phase,
    situation: b.situation,
    by: b.by,
  });
  res.json({ ok: true, flag: rec });
});

// Un-mark a meme (review screen toggle off): removes all its flags.
app.post('/qa/unflag', (req, res) => {
  const b = req.body ?? {};
  if (typeof b.memeId !== 'number') {
    return res.status(400).json({ error: 'memeId (number) is required' });
  }
  const removed = removeFlags(b.memeId);
  res.json({ ok: true, removed });
});

// Just the distinct flagged meme ids — used by the review screen to pre-mark.
app.get('/qa/flagged-ids', (_req, res) => {
  res.json({ ids: flaggedIds() });
});

// Review collected flags as JSON (count + per-meme summary + raw list).
app.get('/qa/flags', (_req, res) => {
  res.json({ count: allFlags().length, summary: summary(), flags: allFlags() });
});

// Download collected flags as CSV.
app.get('/qa/flags.csv', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bad-memes.csv"');
  res.send(toCsv());
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ----------------------------------------------------------------------------
// Broadcast helpers
// ----------------------------------------------------------------------------

// Send each online member their personal view + the lobby player list.
function broadcast(room: Room): void {
  const players = manager.playersInfo(room);
  for (const member of room.members.values()) {
    if (!member.socketId) continue;
    io.to(member.socketId).emit('gameState', {
      roomCode: room.code,
      view: manager.viewFor(room, member.playerId),
      players,
      isHost: member.isHost,
    });
  }
  // Lobby-facing member list (online/ready/score) for any UI that wants it.
  io.to(room.code).emit('roomUpdated', { roomCode: room.code, players });
  syncPhaseTimer(room);
  scheduleBots(room);
}

// If the room has bots and someone still hasn't acted in pick/vote, make the
// bots take their turn after a short, human-like delay. This re-broadcasts,
// which re-evaluates and naturally chains pick -> vote -> reveal.
const BOT_DELAY_MS = 1200;

function scheduleBots(room: Room): void {
  const phase = room.state.phase;
  if (phase !== 'pick' && phase !== 'vote') return;
  const bots = room.state.players.filter((p) => p.id.startsWith('bot'));
  if (bots.length === 0) return;
  const pending = bots.some((p) =>
    phase === 'pick'
      ? !room.state.submissions.some((s) => s.playerId === p.id)
      : !room.state.votes[p.id],
  );
  if (!pending) return;
  if (room.botTimer) return; // already scheduled
  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    if (room.state.phase === 'pick') {
      room.state = botsSubmit(room.state);
    } else if (room.state.phase === 'vote') {
      room.state = botsVote(room.state);
    }
    broadcast(room);
  }, BOT_DELAY_MS);
}

// Schedule (or cancel) the auto-advance timer when the phase changes. Uses the
// per-room/per-round settings (pickSeconds / voteSeconds) from the engine state.
// A small grace buffer is added so genuine slow clients still beat the server.
const TIMER_GRACE_MS = 3000;

function syncPhaseTimer(room: Room): void {
  const { phase, round } = room.state;
  const key = `${phase}:${round}`;
  if (room.timerKey === key) return; // already scheduled for this phase
  if (room.phaseTimer) {
    clearTimeout(room.phaseTimer);
    room.phaseTimer = null;
  }
  room.timerKey = key;

  if (phase === 'pick') {
    const ms = room.state.pickSeconds * 1000 + TIMER_GRACE_MS;
    room.phaseTimer = setTimeout(() => {
      manager.autoAdvancePick(room);
      broadcast(room);
    }, ms);
  } else if (phase === 'vote') {
    const ms = room.state.voteSeconds * 1000 + TIMER_GRACE_MS;
    room.phaseTimer = setTimeout(() => {
      manager.autoAdvanceVote(room);
      broadcast(room);
    }, ms);
  }
}

function emitError(socket: Socket, message: string): void {
  socket.emit('errorMessage', { message });
}

// ----------------------------------------------------------------------------
// Socket.IO connection handling
// ----------------------------------------------------------------------------
io.on('connection', (socket: Socket) => {
  // Track which room this socket is in (for disconnect / leave).
  let joinedCode: string | null = null;

  socket.on('createRoom', (payload: { nickname?: string } = {}) => {
    const { code, playerId, room } = manager.createRoom(payload.nickname ?? '');
    joinedCode = code;
    socket.join(code);
    manager.attachSocket(code, playerId, socket.id);
    socket.emit('roomCreated', { roomCode: code, playerId });
    broadcast(room);
  });

  socket.on('joinRoom', (payload: { roomCode?: string; nickname?: string } = {}) => {
    const res = manager.joinRoom(payload.roomCode ?? '', payload.nickname ?? '');
    if (!res.ok) {
      emitError(socket, res.error);
      return;
    }
    joinedCode = res.room.code;
    socket.join(res.room.code);
    manager.attachSocket(res.room.code, res.playerId, socket.id);
    socket.emit('roomJoined', { roomCode: res.room.code, playerId: res.playerId });
    broadcast(res.room);
  });

  socket.on('leaveRoom', (payload: { roomCode?: string } = {}) => {
    const code = payload.roomCode ?? joinedCode;
    if (!code) return;
    socket.leave(code.toUpperCase());
    const room = manager.leaveRoom(code, socket.id);
    joinedCode = null;
    if (room) broadcast(room);
  });

  socket.on('playerReady', (payload: { roomCode?: string; ready?: boolean } = {}) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;
    manager.setReady(room, playerId, !!payload.ready);
    broadcast(room);
  });

  socket.on('startGame', (payload: { roomCode?: string } = {}) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;
    const ok = manager.hostAdvance(room, playerId);
    if (!ok) {
      emitError(socket, 'Не вдалось почати гру (потрібно щонайменше 2 гравці і права хоста)');
      return;
    }
    broadcast(room);
  });

  // Host advances from the reveal screen to the next round (or finish).
  socket.on('nextRound', (payload: { roomCode?: string } = {}) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;
    manager.hostAdvance(room, playerId);
    broadcast(room);
  });

  socket.on('playCard', (payload: { roomCode?: string; cardId?: number } = {}) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room || typeof payload.cardId !== 'number') return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;
    manager.playCard(room, playerId, payload.cardId);
    broadcast(room);
  });

  // Vote for a submission. Not in the original event draft, but the engine
  // separates pick/vote, so online needs it too (documented in README).
  socket.on('castVote', (payload: { roomCode?: string; submissionId?: string } = {}) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room || !payload.submissionId) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;
    manager.vote(room, playerId, payload.submissionId);
    broadcast(room);
  });

  // Replace a "bad" meme in hand with a fresh one (pick phase only). The engine
  // also posts a system chat message so everyone sees the swap.
  socket.on('replaceCard', (payload: { roomCode?: string; cardId?: number } = {}) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room || typeof payload.cardId !== 'number') return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;
    manager.replaceCard(room, playerId, payload.cardId);
    broadcast(room);
  });

  socket.on('updateSettings', (
    payload: { roomCode?: string; totalRounds?: number; pickSeconds?: number; voteSeconds?: number } = {},
  ) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (playerId !== HOST_ID) return; // only host changes settings
    manager.applySettings(room, {
      totalRounds: payload.totalRounds,
      pickSeconds: payload.pickSeconds,
      voteSeconds: payload.voteSeconds,
    });
    broadcast(room);
  });

  socket.on('sendChatMessage', (payload: { roomCode?: string; text?: string } = {}) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room || !payload.text) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;
    manager.chat(room, playerId, payload.text);
    broadcast(room);
  });

  // Host adds a bot to the lobby (online play vs bots / testing).
  socket.on('addBot', (payload: { roomCode?: string } = {}) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (playerId !== HOST_ID) return; // only host can add bots
    const ok = manager.addBot(room);
    if (!ok) {
      emitError(socket, 'Не вдалось додати бота (кімната заповнена або гра вже почалась)');
      return;
    }
    broadcast(room);
  });

  socket.on('disconnect', () => {
    const res = manager.handleDisconnect(socket.id);
    if (res) broadcast(res.room);
  });
});

// Periodically reap empty rooms (>10 min fully offline).
setInterval(() => {
  const removed = manager.cleanupEmptyRooms();
  if (removed.length) {
    console.log(`[cleanup] removed ${removed.length} empty room(s): ${removed.join(', ')}`);
  }
}, 60 * 1000);

// Bind 0.0.0.0 so the server is reachable inside containers (Bunny/Docker),
// not just localhost.
server.listen(PORT, '0.0.0.0', () => {
  console.log(`MemKarti server listening on 0.0.0.0:${PORT}`);
});
