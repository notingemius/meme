// ============================================================================
// LAN-мульти-плеер игра.
// ----------------------------------------------------------------------------
// Хост держит state, рассылает всем. Клиенты шлют действия.
// 5 раундов. В каждом:
//   1. Хост выбирает ситуацию
//   2. У каждого игрока 8 мемов в руке (на старте раздаются + добираются после игры)
//   3. Все игроки выбирают один мем из руки → submit
//   4. Когда ВСЕ submit'нули — открываются все варианты
//   5. Все голосуют за лучший (МОЖНО голосовать и за свой — по запросу) → vote
//   6. Победитель раунда получает +1 очко
//   7. Сыгранный мем выходит из руки, добирается 1 новый → опять 8
// После 5 раундов — финал.
// ============================================================================

import { SITUATIONS, MEME_CARDS, type Situation, type MemeCard } from './deck';

export type Phase = 'lobby' | 'pick' | 'vote' | 'reveal' | 'finished';

export type Player = {
  id: string;
  nickname: string;
  score: number;
};

export type Submission = {
  id: string;
  playerId: string;
  memeCard: MemeCard;
};

export type GameSettings = {
  totalRounds: number;
  pickSeconds: number;
  voteSeconds: number;
};

export const DEFAULT_SETTINGS: GameSettings = {
  totalRounds: 5,
  pickSeconds: 30,
  voteSeconds: 20,
};

export type ChatMessage = {
  id: string;
  playerId: string;
  nickname: string;
  text: string;
  ts: number;
};

export type LanGameState = {
  phase: Phase;
  players: Player[];
  round: number;
  totalRounds: number;
  pickSeconds: number;
  voteSeconds: number;
  situation: Situation | null;
  hands: Record<string, MemeCard[]>; // у каждого игрока всегда HAND_SIZE мемов
  submissions: Submission[];
  votes: Record<string, string>;
  roundWinner: { playerId: string; submissionId: string } | null;
  // Все мемы, которые уже были розданы (или сыграны) — чтобы не повторялись
  usedMemeIds: number[];
  // Чат в лобби — сохраняется хост, рассылается всем
  chat: ChatMessage[];
};

export type ClientView = {
  phase: Phase;
  players: Player[];
  round: number;
  totalRounds: number;
  pickSeconds: number;
  voteSeconds: number;
  situation: Situation | null;
  myHand: MemeCard[];
  submissions: Submission[];
  // Кто уже сделал свой ход в текущей фазе (для индикатора "ще обирає").
  // В pick: кто submit'нул. В vote: кто проголосовал.
  // Содержимое выбора не раскрывается до фазы vote/reveal.
  doneInPhase: string[];
  // В фазе reveal: разбивка голосов — кто за какой submission голосовал.
  // Ключ = submissionId, значение = массив playerId которые за него.
  voteBreakdown: Record<string, string[]>;
  myPickedSubmissionId: string | null;
  myVotedSubmissionId: string | null;
  roundWinner: { playerId: string; submissionId: string } | null;
  myId: string;
  chat: ChatMessage[];
};

export const HAND_SIZE = 8;

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

function drawCards(state: LanGameState, count: number): { drawn: MemeCard[]; newUsed: number[] } {
  const used = new Set(state.usedMemeIds);
  const available = MEME_CARDS.filter((m) => !used.has(m.id));
  const drawn = rnd(available, count);
  drawn.forEach((m) => used.add(m.id));
  return { drawn, newUsed: Array.from(used) };
}

// ----------------------------------------------------------------------------
// HOST API
// ----------------------------------------------------------------------------

export function createLobby(
  hostNickname: string,
  settings: GameSettings = DEFAULT_SETTINGS,
): LanGameState {
  return {
    phase: 'lobby',
    players: [{ id: 'host', nickname: hostNickname, score: 0 }],
    round: 0,
    totalRounds: settings.totalRounds,
    pickSeconds: settings.pickSeconds,
    voteSeconds: settings.voteSeconds,
    situation: null,
    hands: {},
    submissions: [],
    votes: {},
    roundWinner: null,
    usedMemeIds: [],
    chat: [],
  };
}

// Добавить сообщение в чат. Храним только последние 50.
export function postChatMessage(
  state: LanGameState,
  playerId: string,
  text: string,
): LanGameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;
  const trimmed = text.trim().slice(0, 200);
  if (!trimmed) return state;
  const msg: ChatMessage = {
    id: Math.random().toString(36).slice(2, 10),
    playerId,
    nickname: player.nickname,
    text: trimmed,
    ts: Date.now(),
  };
  return { ...state, chat: [...state.chat, msg].slice(-50) };
}

// Обновить настройки игры (только в лобби; после старта игнорируется).
export function updateSettings(state: LanGameState, settings: Partial<GameSettings>): LanGameState {
  if (state.phase !== 'lobby') return state;
  return {
    ...state,
    totalRounds: settings.totalRounds ?? state.totalRounds,
    pickSeconds: settings.pickSeconds ?? state.pickSeconds,
    voteSeconds: settings.voteSeconds ?? state.voteSeconds,
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
  const { [peerId]: _removed, ...restHands } = state.hands;
  return {
    ...state,
    players: state.players.filter((p) => p.id !== peerId),
    hands: restHands,
  };
}

export function startRound(state: LanGameState): LanGameState {
  if (state.phase === 'finished') return state;
  const nextRound = state.round + 1;
  if (nextRound > state.totalRounds) {
    return { ...state, phase: 'finished' };
  }
  const sit = rnd(SITUATIONS, 1)[0];

  // Раздать/долить до HAND_SIZE каждому игроку
  let used = new Set(state.usedMemeIds);
  const newHands: Record<string, MemeCard[]> = { ...state.hands };
  for (const p of state.players) {
    const current = newHands[p.id] ?? [];
    const needed = HAND_SIZE - current.length;
    if (needed > 0) {
      const available = MEME_CARDS.filter((m) => !used.has(m.id));
      const refill = rnd(available, Math.min(needed, available.length));
      refill.forEach((m) => used.add(m.id));
      newHands[p.id] = [...current, ...refill];
    }
  }

  return {
    ...state,
    phase: 'pick',
    round: nextRound,
    situation: sit,
    hands: newHands,
    submissions: [],
    votes: {},
    roundWinner: null,
    usedMemeIds: Array.from(used),
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
  // Убираем сыгранную карту из руки (она вернётся на startRound для следующего раунда: доберём до 8)
  const newHand = hand.filter((m) => m.id !== memeCardId);
  const newState: LanGameState = {
    ...state,
    hands: { ...state.hands, [playerId]: newHand },
    submissions: [...state.submissions, sub],
  };
  if (newState.submissions.length >= state.players.length) {
    return { ...newState, phase: 'vote' };
  }
  return newState;
}

// Заменить «поганий» мем в руке на новый из колоды.
// Работает только в фазе pick и только до того, как игрок сыграл карту.
// Возвращает новое состояние + системное сообщение в чат о замене.
export function replaceBadCard(
  state: LanGameState,
  playerId: string,
  memeCardId: number,
): LanGameState {
  if (state.phase !== 'pick') return state;
  // Нельзя менять после того как уже сыграл карту в этом раунде.
  if (state.submissions.some((s) => s.playerId === playerId)) return state;
  const player = state.players.find((p) => p.id === playerId);
  const hand = state.hands[playerId] ?? [];
  const idx = hand.findIndex((m) => m.id === memeCardId);
  if (!player || idx === -1) return state;
  const badCard = hand[idx];

  // Берём новую карту, которой ещё не было в игре.
  const used = new Set(state.usedMemeIds);
  const available = MEME_CARDS.filter((m) => !used.has(m.id));
  if (available.length === 0) return state; // колода исчерпана — менять не на что
  const replacement = rnd(available, 1)[0];
  used.add(replacement.id);

  const newHand = [...hand];
  newHand[idx] = replacement;

  // Системное сообщение в чат — какой мем заменили (видно всем в кімнаті).
  const msg: ChatMessage = {
    id: Math.random().toString(36).slice(2, 10),
    playerId: 'system',
    nickname: '🤖 Система',
    text: `${player.nickname} замінив поганий мем «${badCard.title}» на новий`,
    ts: Date.now(),
  };

  return {
    ...state,
    hands: { ...state.hands, [playerId]: newHand },
    usedMemeIds: Array.from(used),
    chat: [...state.chat, msg].slice(-50),
  };
}

// ВОТ ЭТО МЕНЯЛИ: МОЖНО голосовать за свой мем.
export function castVote(
  state: LanGameState,
  voterId: string,
  submissionId: string,
): LanGameState {
  if (state.phase !== 'vote') return state;
  if (state.votes[voterId]) return state;
  const sub = state.submissions.find((s) => s.id === submissionId);
  if (!sub) return state;
  // (Раньше был запрет sub.playerId === voterId — теперь разрешено.)
  const newVotes = { ...state.votes, [voterId]: submissionId };
  const newState = { ...state, votes: newVotes };
  // Все ли проголосовали?
  if (Object.keys(newVotes).length >= state.players.length) {
    return revealResult(newState);
  }
  return newState;
}

function revealResult(state: LanGameState): LanGameState {
  const tally: Record<string, number> = {};
  for (const subId of Object.values(state.votes)) {
    tally[subId] = (tally[subId] ?? 0) + 1;
  }
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

export function viewForPlayer(state: LanGameState, myId: string): ClientView {
  const myHand = state.hands[myId] ?? [];
  const mySub = state.submissions.find((s) => s.playerId === myId);
  let doneInPhase: string[] = [];
  if (state.phase === 'pick') {
    doneInPhase = state.submissions.map((s) => s.playerId);
  } else if (state.phase === 'vote') {
    doneInPhase = Object.keys(state.votes);
  }
  // voteBreakdown — только в reveal, когда все голоса раскрыты.
  const voteBreakdown: Record<string, string[]> = {};
  if (state.phase === 'reveal') {
    for (const [voterId, submissionId] of Object.entries(state.votes)) {
      if (!voteBreakdown[submissionId]) voteBreakdown[submissionId] = [];
      voteBreakdown[submissionId].push(voterId);
    }
  }
  return {
    phase: state.phase,
    players: state.players,
    round: state.round,
    totalRounds: state.totalRounds,
    pickSeconds: state.pickSeconds,
    voteSeconds: state.voteSeconds,
    situation: state.situation,
    myHand,
    submissions: state.phase === 'vote' || state.phase === 'reveal' ? state.submissions : [],
    doneInPhase,
    voteBreakdown,
    myPickedSubmissionId: mySub?.id ?? null,
    myVotedSubmissionId: state.votes[myId] ?? null,
    roundWinner: state.phase === 'reveal' ? state.roundWinner : null,
    myId,
    chat: state.chat,
  };
}

// ----------------------------------------------------------------------------
// Сетевой протокол
// ----------------------------------------------------------------------------
export type ClientMsg =
  | { t: 'hello'; nickname: string }
  | { t: 'submit'; memeCardId: number }
  | { t: 'vote'; submissionId: string }
  | { t: 'chat'; text: string }
  | { t: 'replace'; memeCardId: number };

export type ServerMsg =
  | { t: 'welcome'; myId: string }
  | { t: 'view'; view: ClientView }
  // Для discovery — короткий ответ "это я хост", когда client сканирует
  | { t: 'serverInfo'; nickname: string; players: number };
