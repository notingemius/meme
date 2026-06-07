// Соло-режим с ботами: переиспользуем движок lanGame и добавляем 3 ботов,
// которые автоматически выбирают и голосуют. Так UI один и тот же что для LAN,
// и поведение полностью повторяет настоящий мультиплеер.
import {
  createLobby,
  addPlayer,
  startRound,
  submitPick,
  castVote,
  type LanGameState,
  type DeckData,
} from './lanGame';

const BOT_NAMES = ['Богдан', 'Олена', 'Тарас', 'Маша', 'Петро', 'Софія', 'Назар'];

export function createSoloWithBots(playerNickname: string, botCount: number = 3, deck?: DeckData): LanGameState {
  let s = createLobby(playerNickname, undefined, deck);
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  for (let i = 0; i < botCount; i++) {
    s = addPlayer(s, `bot${i}`, names[i] ?? `Бот${i + 1}`);
  }
  // Сразу стартуем первый раунд — без отдельного лобби.
  return startRound(s);
}

// После того как игрок сделал submit — заставляем ботов сделать свой submit.
export function botsSubmit(state: LanGameState): LanGameState {
  if (state.phase !== 'pick') return state;
  let s = state;
  for (const p of s.players) {
    if (!p.id.startsWith('bot')) continue;
    if (s.submissions.some((sub) => sub.playerId === p.id)) continue;
    const hand = s.hands[p.id] ?? [];
    if (hand.length === 0) continue;
    const pick = hand[Math.floor(Math.random() * hand.length)];
    s = submitPick(s, p.id, pick.id);
  }
  return s;
}

// После того как игрок проголосовал — боты тоже голосуют.
export function botsVote(state: LanGameState): LanGameState {
  if (state.phase !== 'vote') return state;
  let s = state;
  for (const p of s.players) {
    if (!p.id.startsWith('bot')) continue;
    if (s.votes[p.id]) continue;
    const subs = s.submissions;
    if (subs.length === 0) continue;
    // Бот может проголосовать за любую (включая свою — для драмы).
    const vote = subs[Math.floor(Math.random() * subs.length)];
    s = castVote(s, p.id, vote.id);
  }
  return s;
}
