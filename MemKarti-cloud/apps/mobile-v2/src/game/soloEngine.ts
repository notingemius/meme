// Простой соло-режим — играй один против "AI-судьи".
// Каждый раунд:
//   1. Случайная ситуация
//   2. 5 мемов в руке игрока
//   3. Игрок выбирает мем
//   4. "AI-судья" даёт оценку (0-3 очка) на основе случая
//   5. Через 5 раундов — итог
import { SITUATIONS, MEME_CARDS, type Situation, type MemeCard } from './deck';

export type SoloRound = {
  situation: Situation;
  hand: MemeCard[]; // 5 карт
  picked?: MemeCard;
  score?: number; // 0-3 очка которые "судья" дал
};

export type SoloGameState = {
  rounds: SoloRound[];
  currentRoundIndex: number;
  totalScore: number;
  isFinished: boolean;
};

const ROUNDS_PER_GAME = 5;
const HAND_SIZE = 5;

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
  const usedMemeIds = new Set<number>();
  const situations = pickRandom(SITUATIONS, ROUNDS_PER_GAME);

  const rounds: SoloRound[] = situations.map((situation) => {
    // Выбираем 5 уникальных мемов которые ещё не выпадали в этой игре
    const availableMemes = MEME_CARDS.filter((m) => !usedMemeIds.has(m.id));
    const hand = pickRandom(availableMemes, HAND_SIZE);
    hand.forEach((m) => usedMemeIds.add(m.id));
    return { situation, hand };
  });

  return {
    rounds,
    currentRoundIndex: 0,
    totalScore: 0,
    isFinished: false,
  };
}

// "AI-судья" — даёт случайную оценку 1-3.
// (Поскольку у нас нет другого игрока, рандом эмулирует "субъективное мнение".)
function judgePick(_pick: MemeCard, _situation: Situation): number {
  const r = Math.random();
  if (r < 0.15) return 0; // 15% — "не зашло"
  if (r < 0.55) return 1; // 40% — "норм"
  if (r < 0.85) return 2; // 30% — "хорошо"
  return 3; // 15% — "огонь!"
}

export function pickCard(state: SoloGameState, memeId: number): SoloGameState {
  if (state.isFinished) return state;
  const round = state.rounds[state.currentRoundIndex];
  if (!round || round.picked) return state;

  const picked = round.hand.find((m) => m.id === memeId);
  if (!picked) return state;

  const score = judgePick(picked, round.situation);

  const updatedRound: SoloRound = { ...round, picked, score };
  const newRounds = [...state.rounds];
  newRounds[state.currentRoundIndex] = updatedRound;

  return {
    ...state,
    rounds: newRounds,
    totalScore: state.totalScore + score,
  };
}

export function nextRound(state: SoloGameState): SoloGameState {
  if (state.isFinished) return state;
  const nextIdx = state.currentRoundIndex + 1;
  const finished = nextIdx >= state.rounds.length;
  return {
    ...state,
    currentRoundIndex: finished ? state.currentRoundIndex : nextIdx,
    isFinished: finished,
  };
}
