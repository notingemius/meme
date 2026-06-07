// Соло-режим: ты + 3 бота, полный игровой цикл с голосованием.
// Использует тот же движок (lanGame) и UI (LanGameUI) что и LAN multiplayer.
import { useState, useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  startRound,
  submitPick,
  castVote,
  replaceBadCard,
  viewForPlayer,
  type LanGameState,
} from '@/game/lanGame';
import { createSoloWithBots, botsSubmit, botsVote } from '@/game/soloBots';
import { autoPickHumans, autoVoteHumans } from '@/game/autoPlay';
import { LanGameUI } from '@/components/LanGameUI';

export default function SoloScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ nickname?: string }>();
  const nickname = (params.nickname || 'Гравець').toString();

  const [state, setState] = useState<LanGameState>(() => createSoloWithBots(nickname, 3));

  // После выбора игрока — боты делают свой выбор (с небольшой задержкой для драматизма).
  useEffect(() => {
    if (state.phase !== 'pick') return;
    const myDone = state.submissions.some((s) => s.playerId === 'host');
    if (!myDone) return;
    const t = setTimeout(() => setState((s) => botsSubmit(s)), 800);
    return () => clearTimeout(t);
  }, [state.phase, state.submissions]);

  // После голоса игрока — боты тоже голосуют.
  useEffect(() => {
    if (state.phase !== 'vote') return;
    const myVoted = !!state.votes['host'];
    if (!myVoted) return;
    const t = setTimeout(() => setState((s) => botsVote(s)), 1200);
    return () => clearTimeout(t);
  }, [state.phase, state.votes]);

  // Таймер pick-фазы: если не успел — авто-пик случайной карты.
  useEffect(() => {
    if (state.phase !== 'pick') return;
    const myDone = state.submissions.some((s) => s.playerId === 'host');
    if (myDone) return;
    const t = setTimeout(() => {
      setState((s) => autoPickHumans(s));
    }, state.pickSeconds * 1000);
    return () => clearTimeout(t);
  }, [state.phase, state.submissions, state.round, state.pickSeconds]);

  // Таймер vote-фазы.
  useEffect(() => {
    if (state.phase !== 'vote') return;
    const myVoted = !!state.votes['host'];
    if (myVoted) return;
    const t = setTimeout(() => {
      setState((s) => autoVoteHumans(s));
    }, state.voteSeconds * 1000);
    return () => clearTimeout(t);
  }, [state.phase, state.votes, state.round, state.voteSeconds]);

  const handleSubmit = useCallback((memeCardId: number) => {
    setState((s) => submitPick(s, 'host', memeCardId));
  }, []);

  const handleVote = useCallback((submissionId: string) => {
    setState((s) => castVote(s, 'host', submissionId));
  }, []);

  const handleReplace = useCallback((memeCardId: number) => {
    setState((s) => replaceBadCard(s, 'host', memeCardId));
  }, []);

  const handleNextRound = useCallback(() => {
    setState((s) => startRound(s));
  }, []);

  const handleExit = useCallback(() => {
    router.back();
  }, [router]);

  const handleRematch = useCallback(() => {
    setState(createSoloWithBots(nickname, 3));
  }, [nickname]);

  const view = viewForPlayer(state, 'host');

  return (
    <View style={{ flex: 1 }}>
      <LanGameUI
        view={view}
        insets={insets}
        isHost={true}
        onSubmit={handleSubmit}
        onVote={handleVote}
        onNextRound={handleNextRound}
        onExit={handleExit}
        onRematch={handleRematch}
        onReplaceCard={handleReplace}
      />
    </View>
  );
}
