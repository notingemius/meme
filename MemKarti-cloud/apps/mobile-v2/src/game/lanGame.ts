// ============================================================================
// LAN-мульти-плеер игра.
// ----------------------------------------------------------------------------
// Хост держит state, рассылает всем. Клиенты шлют действия.
// 5 раундов. В каждом:
//   1. Хост выбирает ситуацию + раздаёт по 5 мемов каждому
//   2. Все игроки выбирают один мем из руки → submit
//   3. Когда ВСЕ submit'нули — хост открывает все варианты (анонимно)
//   4. Все голосуют за лучший (нельзя голосовать за свой) → vote
//   5. Победитель раунда получает +1 очко
//   6. Следующий раунд
// После 5 раундов — финал, у кого больше очков.
// ============================================================================

import { SITUATIONS, MEME_CARDS, type Situation, type MemeCard } from './deck';

export type Phase = 'lobby' | 'pick' | 'vote' | 'reveal' | 'finished';

export type Player = {
  id: string; // host = 'host', clients = peer.id
  nickname: string;
  score: number;
};

export type Submission = {
  id: string; // submission id (random)
  playerId: string;
  memeCard: MemeCard;
};

export type LanGameState = {
  phase: Phase;
  players: Player[];
  round: number; // 1-based
  totalRounds: number;
  situation: Situation | null;
  // per-player hand. only sent privately to that player in client view.
  hands: Record<string, MemeCard[]>;
  submissions: Submission[];
  votes: Record<string, string>; // voterPlayerId -> submissionId
  roundWinner: { playerId: string; submissionId: string } | null;
};

// Клиентский view — то что видит каждый игрок (без чужих рук).
export type ClientView = {
  phase: Phase;
  players: Player[];
  round: number;
  totalRounds: number;
  situation: Situation | null;
  myHand: MemeCard[]; // только моя рука
  submissions: Submission[]; // в фазе vote/reveal — все ответы
  myPickedSubmissionId: string | null;
  myVotedSubmissionId: string | null;
  roundWinner: { playerId: string; submissionId: string } | null;
  myId: string;
};

const ROUNDS = 5;
const HAND_SIZE = 5;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rnd<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

function newSubmissionId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ----------------------------------------------------------------------------
// HOST API — мутации стейта (только на хосте)
// ----------------------------------------------------------------------------

export function createLobby(hostNickname: string): LanGameState {
  return {
    phase: 'lobby',
    players: [{ id: 'host', nickname: hostNickname, score: 0 }],
    round: 0,
    totalRounds: ROUNDS,
    situation: null,
    hands: {},
    submissions: [],
    votes: {},
    roundWinner: null,
  };
}

export function addPlayer(state: LanGameState, peerId: string, nickname: string): LanGameState {
  if (state.players.some((p) => p.id === peerId)) return state;
  return {
    ...state,
    players: [...state.players, { id: peerId, nickname, score: 0 }],
  };
}

export function removePlayer(state: LanGameState, peerId: string): LanGameState {
  return {
    ...state,
    players: state.players.filter((p) => p.id !== peerId),
  };
}

export function startRound(state: LanGameState): LanGameState {
  if (state.phase === 'finished') return state;
  const nextRound = state.round + 1;
  if (nextRound > state.totalRounds) {
    return { ...state, phase: 'finished' };
  }
  const sit = rnd(SITUATIONS, 1)[0];
  const usedMemes = new Set<number>();
  Object.values(state.hands).flat().forEach((m) => usedMemes.add(m.id));
  const available = MEME_CARDS.filter((m) => !usedMemes.has(m.id));
  const hands: Record<string, MemeCard[]> = {};
  for (const p of state.players) {
    const hand = rnd(available, HAND_SIZE);
    hand.forEach((m) => usedMemes.add(m.id));
    hands[p.id] = hand;
    // remove these from available for next player
    for (const card of hand) {
      const idx = available.findIndex((m) => m.id === card.id);
      if (idx >= 0) available.splice(idx, 1);
    }
  }
  return {
    ...state,
    phase: 'pick',
    round: nextRound,
    situation: sit,
    hands,
    submissions: [],
    votes: {},
    roundWinner: null,
  };
}

export function submitPick(
  state: LanGameState,
  playerId: string,
  memeCardId: number,
): LanGameState {
  if (state.phase !== 'pick') return state;
  if (state.submissions.some((s) => s.playerId === playerId)) return state;
  const hand = state.hands[playerId] ?? [];
  const card = hand.find((m) => m.id === memeCardId);
  if (!card) return state;
  const sub: Submission = {
    id: newSubmissionId(),
    playerId,
    memeCard: card,
  };
  const newState = { ...state, submissions: [...state.submissions, sub] };
  // Если все игроки сделали выбор — переходим к голосованию
  if (newState.submissions.length >= state.players.length) {
    return { ...newState, phase: 'vote' };
  }
  return newState;
}

export function castVote(
  state: LanGameState,
  voterId: string,
  submissionId: string,
): LanGameState {
  if (state.phase !== 'vote') return state;
  if (state.votes[voterId]) return state;
  // нельзя голосовать за свою картинку
  const sub = state.submissions.find((s) => s.id === submissionId);
  if (!sub) return state;
  if (sub.playerId === voterId) return state;
  const newVotes = { ...state.votes, [voterId]: submissionId };
  const newState = { ...state, votes: newVotes };
  // Если все проголосовали — определяем победителя
  if (Object.keys(newVotes).length >= state.players.length - getNonVoters(state)) {
    return revealResult(newState);
  }
  return newState;
}

// Игроки, которые НЕ могут голосовать в этом раунде (никто не submit'нул мем).
// На практике это всегда 0 если все submit'нули, но безопасности ради.
function getNonVoters(state: LanGameState): number {
  // голосуют только те, у кого есть submission в этом раунде
  return state.players.filter(
    (p) => !state.submissions.some((s) => s.playerId === p.id),
  ).length;
}

function revealResult(state: LanGameState): LanGameState {
  // Подсчитываем голоса
  const tally: Record<string, number> = {};
  for (const subId of Object.values(state.votes)) {
    tally[subId] = (tally[subId] ?? 0) + 1;
  }
  // Находим submission с максимумом голосов
  let winnerSubId: string | null = null;
  let max = -1;
  for (const sub of state.submissions) {
    const v = tally[sub.id] ?? 0;
    if (v > max) {
      max = v;
      winnerSubId = sub.id;
    }
  }
  if (!winnerSubId) return { ...state, phase: 'reveal', roundWinner: null };
  const winnerSub = state.submissions.find((s) => s.id === winnerSubId)!;
  // Начисляем очко
  const updatedPlayers = state.players.map((p) =>
    p.id === winnerSub.playerId ? { ...p, score: p.score + 1 } : p,
  );
  return {
    ...state,
    phase: 'reveal',
    players: updatedPlayers,
    roundWinner: { playerId: winnerSub.playerId, submissionId: winnerSubId },
  };
}

// ----------------------------------------------------------------------------
// Превращаем серверный state в персональный view для конкретного игрока.
// ----------------------------------------------------------------------------
export function viewForPlayer(state: LanGameState, myId: string): ClientView {
  const myHand = state.hands[myId] ?? [];
  const mySub = state.submissions.find((s) => s.playerId === myId);
  return {
    phase: state.phase,
    players: state.players,
    round: state.round,
    totalRounds: state.totalRounds,
    situation: state.situation,
    myHand,
    submissions: state.phase === 'vote' || state.phase === 'reveal' ? state.submissions : [],
    myPickedSubmissionId: mySub?.id ?? null,
    myVotedSubmissionId: state.votes[myId] ?? null,
    roundWinner: state.phase === 'reveal' ? state.roundWinner : null,
    myId,
  };
}

// ----------------------------------------------------------------------------
// Сетевой протокол
// ----------------------------------------------------------------------------
export type ClientMsg =
  | { t: 'hello'; nickname: string }
  | { t: 'submit'; memeCardId: number }
  | { t: 'vote'; submissionId: string }
  | { t: 'startRound' } // только хост; клиенты игнорируют
  | { t: 'startGame' }; // хост → начать игру из лобби

export type ServerMsg =
  | { t: 'welcome'; myId: string }
  | { t: 'view'; view: ClientView };
