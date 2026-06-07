// ============================================================================
// Game engine — SINGLE SOURCE OF TRUTH.
// ----------------------------------------------------------------------------
// The online server runs the EXACT same game logic as the offline/LAN modes.
// We do NOT reimplement any rules here — we re-export the real engine that the
// mobile app uses (apps/mobile-v2/src/game/lanGame.ts) and its auto-play helper.
//
// lanGame.ts depends only on ./deck (pure data, no React Native), so it runs
// unchanged under Node via tsx. If the game rules ever change in the app, the
// server automatically picks them up — no drift possible.
// ============================================================================

export {
  createLobby,
  addPlayer,
  removePlayer,
  startRound,
  submitPick,
  castVote,
  replaceBadCard,
  updateSettings,
  postChatMessage,
  viewForPlayer,
  HAND_SIZE,
  DEFAULT_SETTINGS,
} from '../../MemKarti-cloud/apps/mobile-v2/src/game/lanGame';

export type {
  LanGameState,
  ClientView,
  Player,
  Submission,
  ChatMessage,
  GameSettings,
  Phase,
} from '../../MemKarti-cloud/apps/mobile-v2/src/game/lanGame';

// Auto-play helpers: on the online server there are no bots, so these advance
// the round for ANY player who didn't act in time (timeout / disconnect),
// preventing a stalled room. Reused verbatim from the app.
export {
  autoPickHumans,
  autoVoteHumans,
} from '../../MemKarti-cloud/apps/mobile-v2/src/game/autoPlay';

// Bot helpers (reused from the app's solo-with-bots mode). On the online server
// the host can add bots to a room; these make every bot pick/vote automatically.
export {
  botsSubmit,
  botsVote,
} from '../../MemKarti-cloud/apps/mobile-v2/src/game/soloBots';
