// Простой соло-режим — играй один против "AI-судьи".
// 5 раундов. У игрока в руке всегда 8 карт (на старте раздаются + добираются после сыгранной).
import { SITUATIONS, MEME_CARDS, type Situation, type MemeCard } from './deck';

export type SoloRound = {
  situation: Situation;
  picked?: MemeCard;
  score?: number; // 0-3 очка от "AI-судьи"
};

export type SoloGameState = {
  rounds: SoloRound[];
  currentRoundIndex: number;
  totalScore: number;
  isFinished: boolean;

  hand: MemeCard[];        // всегда HAND_SIZE карт (пока хватает в колоде)
  usedMemeIds: number[];   // мемы уже розданные/сыгранные
};

const ROUNDS_PER_GAME = 5;
export const HAND_SIZE = 8;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom<T>(arr: T[], count: number): T[] {
  return shuffle(arr).slice(0, count);
}

export function createSoloGame(): SoloGameState {
  const used = new Set<number>();
  const situations = pickRandom(SITUATIONS, ROUNDS_PER_GAME);
  const rounds: SoloRound[] = situations.map((situation) => ({ situation }));

  // Стартовая рука 8 карт
  const available = MEME_CARDS.filter((m) => !used.has(m.id));
  const hand = pickRandom(available, HAND_SIZE);
  hand.forEach((m) => used.add(m.id));

  return {
    rounds,
    currentRoundIndex: 0,
    totalScore: 0,
    isFinished: false,
    hand,
    usedMemeIds: Array.from(used),
  };
}

function judgePick(_pick: MemeCard, _situation: Situation): number {
  const r = Math.random();
  if (r < 0.15) return 0;
  if (r < 0.55) return 1;
  if (r < 0.85) return 2;
  return 3;
}

export function pickCard(state: SoloGameState, memeId: number): SoloGameState {
  if (state.isFinished) return state;
  const round = state.rounds[state.currentRoundIndex];
  if (!round || round.picked) return state;

  const picked = state.hand.find((m) => m.id === memeId);
  if (!picked) return state;

  const score = judgePick(picked, round.situation);

  const updatedRound: SoloRound = { ...round, picked, score };
  const newRounds = [...state.rounds];
  newRounds[state.currentRoundIndex] = updatedRound;

  // Убираем сыгранную карту из руки
  const handWithout = state.hand.filter((m) => m.id !== memeId);

  return {
    ...state,
    rounds: newRounds,
    totalScore: state.totalScore + score,
    hand: handWithout,
  };
}

export function nextRound(state: SoloGameState): SoloGameState {
  if (state.isFinished) return state;

  // Доливаем руку до HAND_SIZE
  const used = new Set(state.usedMemeIds);
  const need = HAND_SIZE - state.hand.length;
  let refilled = state.hand;
  let newUsedIds = state.usedMemeIds;
  if (need > 0) {
    const available = MEME_CARDS.filter((m) => !used.has(m.id));
    const refill = pickRandom(available, Math.min(need, available.length));
    refill.forEach((m) => used.add(m.id));
    refilled = [...state.hand, ...refill];
    newUsedIds = Array.from(used);
  }

  const nextIdx = state.currentRoundIndex + 1;
  const finished = nextIdx >= state.rounds.length;
  return {
    ...state,
    currentRoundIndex: finished ? state.currentRoundIndex : nextIdx,
    isFinished: finished,
    hand: refilled,
    usedMemeIds: newUsedIds,
  };
}
