// ============================================================================
// RoomManager — in-memory room store for online multiplayer.
// ----------------------------------------------------------------------------
// Each room wraps ONE LanGameState (the shared engine) plus connection
// metadata (online/ready flags, socket mapping). All game rules come from the
// engine; this file only manages rooms, codes, membership and lifecycle.
// ============================================================================

import {
  createLobby,
  addPlayer,
  removePlayer,
  startRound,
  submitPick,
  castVote,
  updateSettings,
  postChatMessage,
  viewForPlayer,
  autoPickHumans,
  autoVoteHumans,
  type LanGameState,
  type ClientView,
  type GameSettings,
} from './engine';

// The creator of the room always maps to engine player id 'host' (same id the
// engine assigns in createLobby), so host-only actions are easy to authorize.
const HOST_ID = 'host';

// Room codes: 4-6 chars. We use 5 from an unambiguous alphabet (no 0/O/1/I).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

const MAX_PLAYERS = 8;
const MIN_PLAYERS_TO_START = 2;

// Remove a room that has been completely empty (everyone offline) for >10 min.
const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000;

export type Member = {
  playerId: string;
  nickname: string;
  socketId: string | null;
  online: boolean;
  ready: boolean;
  isHost: boolean;
};

// Lobby-facing player info (combines engine score with connection flags).
export type RoomPlayerInfo = {
  playerId: string;
  nickname: string;
  score: number;
  online: boolean;
  ready: boolean;
  isHost: boolean;
};

export type Room = {
  code: string;
  state: LanGameState;
  members: Map<string, Member>; // keyed by playerId
  socketToPlayer: Map<string, string>; // socketId -> playerId
  seq: number; // counter for generating joiner ids (p1, p2, ...)
  createdAt: number;
  emptySince: number | null; // timestamp when room became fully offline
  // Server-side timer that auto-advances the round on timeout (set by index.ts).
  phaseTimer: ReturnType<typeof setTimeout> | null;
  // Identifies what the current phaseTimer is for (`${phase}:${round}`), so we
  // don't restart the timer on every unrelated broadcast.
  timerKey: string | null;
};

export type JoinResult =
  | { ok: true; playerId: string; room: Room }
  | { ok: false; error: string };

export class RoomManager {
  private rooms = new Map<string, Room>();

  // --- code generation ------------------------------------------------------
  private generateCode(): string {
    let code = '';
    do {
      code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  getRoom(code: string | undefined | null): Room | undefined {
    if (!code) return undefined;
    return this.rooms.get(code.toUpperCase());
  }

  playerOf(code: string, socketId: string): string | undefined {
    return this.getRoom(code)?.socketToPlayer.get(socketId);
  }

  // --- lifecycle ------------------------------------------------------------
  createRoom(nickname: string): { code: string; playerId: string; room: Room } {
    const cleanNick = (nickname || '').trim().slice(0, 20) || 'Гравець';
    const code = this.generateCode();
    const state = createLobby(cleanNick);
    const members = new Map<string, Member>();
    members.set(HOST_ID, {
      playerId: HOST_ID,
      nickname: cleanNick,
      socketId: null,
      online: true,
      ready: true,
      isHost: true,
    });
    const room: Room = {
      code,
      state,
      members,
      socketToPlayer: new Map(),
      seq: 0,
      createdAt: Date.now(),
      emptySince: null,
      phaseTimer: null,
      timerKey: null,
    };
    this.rooms.set(code, room);
    return { code, playerId: HOST_ID, room };
  }

  joinRoom(code: string, nickname: string): JoinResult {
    const room = this.getRoom(code);
    if (!room) return { ok: false, error: 'Кімнату не знайдено' };
    if (room.state.phase !== 'lobby') return { ok: false, error: 'Гра вже почалась' };
    if (room.members.size >= MAX_PLAYERS) return { ok: false, error: 'Кімната заповнена' };

    const cleanNick = (nickname || '').trim().slice(0, 20) || 'Гравець';
    const playerId = `p${++room.seq}`;
    room.state = addPlayer(room.state, playerId, cleanNick);
    room.members.set(playerId, {
      playerId,
      nickname: cleanNick,
      socketId: null,
      online: true,
      ready: false,
      isHost: false,
    });
    room.emptySince = null;
    return { ok: true, playerId, room };
  }

  // Bind a live socket to a player (on create/join, or reconnect).
  attachSocket(code: string, playerId: string, socketId: string): void {
    const room = this.getRoom(code);
    if (!room) return;
    const member = room.members.get(playerId);
    if (!member) return;
    member.socketId = socketId;
    member.online = true;
    room.socketToPlayer.set(socketId, playerId);
    room.emptySince = null;
  }

  // A socket dropped: mark its player offline. In the lobby we drop the player
  // entirely (so they don't block the start); mid-game we keep them so the
  // scoreboard/turn order stays intact and auto-play can cover their turn.
  handleDisconnect(socketId: string): { room: Room; playerId: string } | null {
    for (const room of this.rooms.values()) {
      const playerId = room.socketToPlayer.get(socketId);
      if (!playerId) continue;
      room.socketToPlayer.delete(socketId);
      const member = room.members.get(playerId);
      if (member) {
        member.online = false;
        member.socketId = null;
        if (room.state.phase === 'lobby' && playerId !== HOST_ID) {
          room.state = removePlayer(room.state, playerId);
          room.members.delete(playerId);
        }
      }
      this.touchEmptiness(room);
      return { room, playerId };
    }
    return null;
  }

  leaveRoom(code: string, socketId: string): Room | null {
    const room = this.getRoom(code);
    if (!room) return null;
    const playerId = room.socketToPlayer.get(socketId);
    if (!playerId) return room;
    room.socketToPlayer.delete(socketId);
    const member = room.members.get(playerId);
    if (member) {
      member.online = false;
      member.socketId = null;
    }
    // Explicit leave removes the player from the game (host leaving too).
    if (playerId !== HOST_ID || room.state.phase === 'lobby') {
      room.state = removePlayer(room.state, playerId);
      room.members.delete(playerId);
    }
    this.touchEmptiness(room);
    return room;
  }

  private touchEmptiness(room: Room): void {
    const anyOnline = [...room.members.values()].some((m) => m.online);
    room.emptySince = anyOnline ? null : Date.now();
  }

  // --- in-game actions (all delegate to the engine) -------------------------
  setReady(room: Room, playerId: string, ready: boolean): void {
    const member = room.members.get(playerId);
    if (member) member.ready = ready;
  }

  // Begin the game / advance to the next round. Only the host may trigger.
  // From 'lobby' it requires >= 2 players; from 'reveal' it just advances.
  hostAdvance(room: Room, playerId: string): boolean {
    if (playerId !== HOST_ID) return false;
    if (room.state.phase === 'lobby' && room.state.players.length < MIN_PLAYERS_TO_START) {
      return false;
    }
    room.state = startRound(room.state);
    return true;
  }

  playCard(room: Room, playerId: string, cardId: number): void {
    room.state = submitPick(room.state, playerId, cardId);
  }

  vote(room: Room, playerId: string, submissionId: string): void {
    room.state = castVote(room.state, playerId, submissionId);
  }

  chat(room: Room, playerId: string, text: string): void {
    room.state = postChatMessage(room.state, playerId, text);
  }

  applySettings(room: Room, settings: Partial<GameSettings>): void {
    room.state = updateSettings(room.state, settings);
  }

  // Auto-play for everyone who didn't act before the phase timer expired.
  autoAdvancePick(room: Room): void {
    room.state = autoPickHumans(room.state);
  }
  autoAdvanceVote(room: Room): void {
    room.state = autoVoteHumans(room.state);
  }

  // --- views ----------------------------------------------------------------
  viewFor(room: Room, playerId: string): ClientView {
    return viewForPlayer(room.state, playerId);
  }

  playersInfo(room: Room): RoomPlayerInfo[] {
    return room.state.players.map((p) => {
      const m = room.members.get(p.id);
      return {
        playerId: p.id,
        nickname: p.nickname,
        score: p.score,
        online: m?.online ?? false,
        ready: m?.ready ?? false,
        isHost: p.id === HOST_ID,
      };
    });
  }

  // --- maintenance ----------------------------------------------------------
  // Drop rooms that have been empty for too long. Returns removed codes.
  cleanupEmptyRooms(now = Date.now()): string[] {
    const removed: string[] = [];
    for (const [code, room] of this.rooms.entries()) {
      const isEmpty = room.members.size === 0 || ![...room.members.values()].some((m) => m.online);
      if (isEmpty && room.emptySince && now - room.emptySince > EMPTY_ROOM_TTL_MS) {
        if (room.phaseTimer) clearTimeout(room.phaseTimer);
        this.rooms.delete(code);
        removed.push(code);
      }
    }
    return removed;
  }

  get roomCount(): number {
    return this.rooms.size;
  }
}

export { HOST_ID, MIN_PLAYERS_TO_START, MAX_PLAYERS };
