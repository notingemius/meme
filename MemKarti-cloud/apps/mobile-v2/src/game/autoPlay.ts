// Авто-пик / авто-голос для игроков которые не успели в таймере.
// Используется и в соло (для самого себя), и в LAN host (для отстающих).
import { submitPick, castVote, type LanGameState } from './lanGame';

// За всех ИГРОКОВ-ЛЮДЕЙ (не ботов), которые ещё не сделали submit, тыкаем случайную карту.
export function autoPickHumans(state: LanGameState): LanGameState {
  if (state.phase !== 'pick') return state;
  let s = state;
  for (const p of s.players) {
    if (p.id.startsWith('bot')) continue;
    if (s.submissions.some((sub) => sub.playerId === p.id)) continue;
    const hand = s.hands[p.id] ?? [];
    if (hand.length === 0) continue;
    const pick = hand[Math.floor(Math.random() * hand.length)];
    s = submitPick(s, p.id, pick.id);
  }
  return s;
}

// За людей, не проголосовавших — голосуем случайно.
export function autoVoteHumans(state: LanGameState): LanGameState {
  if (state.phase !== 'vote') return state;
  let s = state;
  for (const p of s.players) {
    if (p.id.startsWith('bot')) continue;
    if (s.votes[p.id]) continue;
    if (s.submissions.length === 0) continue;
    const vote = s.submissions[Math.floor(Math.random() * s.submissions.length)];
    s = castVote(s, p.id, vote.id);
  }
  return s;
}
