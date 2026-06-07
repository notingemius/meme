import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import type { ClientView } from '@/game/lanGame';
import { HandPicker } from './HandPicker';
import { DropIn, FadeIn } from './RevealAnimation';
import { Avatar } from './Avatar';
import { PhaseTimer } from './PhaseTimer';
import { Confetti } from './Confetti';
import { FlipCard } from './FlipCard';

type Props = {
  view: ClientView;
  insets: { top: number; bottom: number };
  isHost: boolean;
  onSubmit: (memeCardId: number) => void;
  onVote: (submissionId: string) => void;
  onNextRound: () => void;
  onExit: () => void;
  onRematch?: () => void; // только для хоста / соло
};

export function LanGameUI({ view, insets, isHost, onSubmit, onVote, onNextRound, onExit, onRematch }: Props) {
  // ============= FINISHED =============
  if (view.phase === 'finished') {
    const sorted = [...view.players].sort((a, b) => b.score - a.score);
    const top = sorted[0];
    return (
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <Confetti />
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.bigTitle}>🏆 Гру завершено</Text>
          <Text style={styles.sub}>
            Переможець: <Text style={styles.winnerName}>{top?.nickname ?? '—'}</Text>
          </Text>
          <View style={styles.podium}>
            {sorted.map((p, i) => (
              <View key={p.id} style={[styles.podiumRow, i === 0 && styles.podiumRowWinner]}>
                <Text style={[styles.podiumPlace, i === 0 && { color: '#92400E' }]}>
                  {i === 0 ? '👑' : `${i + 1}.`}
                </Text>
                <View style={{ marginRight: 10 }}>
                  <Avatar id={p.id} nickname={p.nickname} size={36} border={i === 0} />
                </View>
                <Text style={styles.podiumName}>{p.nickname}</Text>
                <Text style={[styles.podiumScore, i === 0 && { color: '#92400E' }]}>
                  {p.score} оч.
                </Text>
              </View>
            ))}
          </View>
          {isHost && onRematch && (
            <TouchableOpacity onPress={onRematch} style={[styles.btnPrimary, { marginTop: 24 }]}>
              <Text style={styles.btnPrimaryText}>🔄 Реванш — ще раз</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onExit}
            style={[isHost && onRematch ? styles.btnSecondary : styles.btnPrimary, { marginTop: 12 }]}
          >
            <Text style={isHost && onRematch ? styles.btnSecondaryText : styles.btnPrimaryText}>
              На головну
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ============= REVEAL =============
  if (view.phase === 'reveal') {
    const winnerSub = view.submissions.find((s) => s.id === view.roundWinner?.submissionId);
    const winnerPlayer = winnerSub
      ? view.players.find((p) => p.id === winnerSub.playerId)
      : null;
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <RoundHeader view={view} />
          <Text style={styles.label}>СИТУАЦІЯ</Text>
          <Text style={styles.situation}>{view.situation?.text_ua}</Text>

          {winnerSub && winnerPlayer ? (
            <FadeIn delay={view.submissions.length * 200 + 400}>
              <Pulse>
                <View style={styles.winnerCard}>
                  <Text style={styles.winnerLabel}>👑 ПЕРЕМОЖЕЦЬ РАУНДУ</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Avatar id={winnerPlayer.id} nickname={winnerPlayer.nickname} size={48} border />
                    <Text style={[styles.winnerName, { marginLeft: 12, marginBottom: 0 }]}>
                      {winnerPlayer.nickname}
                    </Text>
                  </View>
                  <Image source={{ uri: winnerSub.memeCard.image_url }} style={styles.bigImg} />
                  <Text style={styles.memeTitleLarge}>{winnerSub.memeCard.title}</Text>
                </View>
              </Pulse>
            </FadeIn>
          ) : null}

          <Text style={[styles.label, { marginTop: 24 }]}>УСІ ВАРІАНТИ</Text>
          {view.submissions.map((sub, i) => {
            const player = view.players.find((p) => p.id === sub.playerId);
            const isWinner = sub.id === view.roundWinner?.submissionId;
            const voters = (view.voteBreakdown[sub.id] ?? [])
              .map((vid) => view.players.find((p) => p.id === vid))
              .filter(Boolean) as typeof view.players;
            return (
              <DropIn key={sub.id} delay={i * 200}>
                <View style={[styles.bigSubCard, isWinner && styles.bigSubCardWinner]}>
                  <Image source={{ uri: sub.memeCard.image_url }} style={styles.bigSubImg} />
                  <View style={styles.bigSubMeta}>
                    <Text style={styles.bigSubTitle} numberOfLines={2}>{sub.memeCard.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                      <Avatar id={sub.playerId} nickname={player?.nickname ?? '?'} size={20} />
                      <Text style={[styles.bigSubPlayer, { marginLeft: 6 }]}>
                        від {player?.nickname ?? '?'}
                      </Text>
                    </View>
                    {voters.length > 0 && (
                      <View style={styles.voteBreakdownRow}>
                        <Text style={styles.voteBreakdownLabel}>
                          {voters.length} {voters.length === 1 ? 'голос' : 'голоси'}:
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', flex: 1 }}>
                          {voters.map((v) => (
                            <View key={v.id} style={styles.voterChip}>
                              <Avatar id={v.id} nickname={v.nickname} size={18} />
                              <Text style={styles.voterName}>{v.nickname}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              </DropIn>
            );
          })}

          <Text style={[styles.label, { marginTop: 24 }]}>РАХУНОК</Text>
          {view.players.map((p) => (
            <View key={p.id} style={styles.scoreRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Avatar id={p.id} nickname={p.nickname} size={32} />
                <Text style={[styles.scoreName, { marginLeft: 10 }]}>
                  {p.nickname}
                  {p.id === view.myId ? ' (ти)' : ''}
                </Text>
              </View>
              <Text style={styles.scoreVal}>★ {p.score}</Text>
            </View>
          ))}

          {isHost ? (
            <TouchableOpacity onPress={onNextRound} style={[styles.btnPrimary, { marginTop: 24 }]}>
              <Text style={styles.btnPrimaryText}>
                {view.round >= view.totalRounds ? 'Подивитись фінал' : 'Наступний раунд →'}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.waiting}>Чекаємо хоста для наступного раунду…</Text>
          )}
        </ScrollView>
      </View>
    );
  }

  // ============= VOTE =============
  if (view.phase === 'vote') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <RoundHeader view={view} />
          {!view.myVotedSubmissionId && (
            <PhaseTimer
              resetKey={`vote-${view.round}`}
              totalSec={view.voteSeconds}
              label="на голосування"
            />
          )}
          <Text style={styles.label}>СИТУАЦІЯ</Text>
          <Text style={styles.situation}>{view.situation?.text_ua}</Text>

          <Text style={[styles.label, { marginTop: 24 }]}>ОБЕРИ НАЙСМІШНІШИЙ (можна і за свій)</Text>
          <WaitingFor view={view} verb="голосує" />
          {view.submissions.map((sub, i) => {
            const voted = view.myVotedSubmissionId === sub.id;
            const isMine = sub.playerId === view.myId;
            return (
              <TouchableOpacity
                key={sub.id}
                disabled={!!view.myVotedSubmissionId}
                onPress={() => onVote(sub.id)}
                activeOpacity={0.85}
                style={[styles.bigSubCardWrap, voted && styles.bigSubCardVoted]}
              >
                <FlipCard
                  imageUrl={sub.memeCard.image_url}
                  title={sub.memeCard.title}
                  height={260}
                  delay={i * 400 + 200}
                />
                <View style={styles.bigSubMeta}>
                  {isMine && <Text style={styles.bigSubPlayer}>(твій вибір)</Text>}
                  {voted && <Text style={styles.votedBadge}>✓ Твій голос</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
          {view.myVotedSubmissionId && (
            <Text style={styles.waiting}>Голос прийнято. Чекаємо інших…</Text>
          )}
        </ScrollView>
      </View>
    );
  }

  // ============= PICK =============
  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <RoundHeader view={view} />
        {!view.myPickedSubmissionId && (
          <PhaseTimer
            resetKey={`pick-${view.round}`}
            totalSec={view.pickSeconds}
            label="на вибір мема"
          />
        )}
        <Text style={styles.label}>СИТУАЦІЯ</Text>
        <Text style={styles.situation}>{view.situation?.text_ua}</Text>

        <Text style={[styles.label, { marginTop: 20, marginBottom: 4 }]}>
          ТВОЯ РУКА · ГОРТАЙ ТА ОБЕРИ
        </Text>

        <WaitingFor view={view} verb="обирає" />
      </ScrollView>

      <View style={{ marginHorizontal: -16 }}>
        <HandPicker
          hand={view.myHand}
          onPick={(id) => onSubmit(id)}
          disabled={!!view.myPickedSubmissionId}
        />
      </View>
    </View>
  );
}

function RoundHeader({ view }: { view: ClientView }) {
  return (
    <View style={styles.roundHeader}>
      <Text style={styles.roundText}>
        Раунд {view.round} / {view.totalRounds}
      </Text>
      <Text style={styles.roundText}>{view.players.length} гравців</Text>
    </View>
  );
}

// Индикатор: чьего хода ещё ждём.
function WaitingFor({ view, verb }: { view: ClientView; verb: string }) {
  const done = new Set(view.doneInPhase);
  const waiting = view.players.filter((p) => !done.has(p.id));
  if (waiting.length === 0) return null;
  return (
    <View style={styles.waitingBox}>
      <Text style={styles.waitingText}>Ще {verb}:</Text>
      <View style={styles.waitingAvatars}>
        {waiting.map((p) => (
          <View key={p.id} style={styles.waitingAvatarWrap}>
            <Avatar id={p.id} nickname={p.nickname} size={28} />
            <Text style={styles.waitingName}>{p.nickname}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Пульс анимация — обёртка для победной карты.
function Pulse({ children }: { children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.04,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [scale]);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  roundHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  roundText: { color: '#6B7280', fontSize: 13, fontWeight: '500' },

  label: { fontSize: 11, fontWeight: '600', color: '#6B7280', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  situation: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', backgroundColor: '#2563EB', padding: 18, borderRadius: 14, lineHeight: 24 },

  // Big submission cards (vote and reveal phase)
  bigSubCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, marginBottom: 14,
    borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  bigSubCardWrap: {
    marginBottom: 14, borderRadius: 14, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  bigSubCardWinner: { borderColor: '#F59E0B', borderWidth: 3, backgroundColor: '#FFFBEB' },
  bigSubCardVoted: { borderColor: '#2563EB', borderWidth: 3, backgroundColor: '#EFF6FF' },
  bigSubImg: { width: '100%', height: 260, backgroundColor: '#F3F4F6' },
  bigSubMeta: { padding: 12 },
  bigSubTitle: { fontSize: 14, color: '#111827', fontWeight: '600' },
  bigSubPlayer: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  votedBadge: { fontSize: 12, color: '#2563EB', fontWeight: '700', marginTop: 4 },

  scoreRow: {
    flexDirection: 'row', justifyContent: 'space-between', padding: 12,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, marginBottom: 6,
  },
  scoreName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  scoreVal: { fontSize: 14, fontWeight: '700', color: '#2563EB' },

  winnerCard: {
    backgroundColor: '#FEF3C7', borderRadius: 18, padding: 18,
    marginTop: 16, alignItems: 'center',
  },
  winnerLabel: { fontSize: 11, fontWeight: '700', color: '#92400E', letterSpacing: 1, marginBottom: 6 },
  winnerName: { fontSize: 24, fontWeight: '800', color: '#78350F', marginBottom: 12 },
  bigImg: { width: '100%', height: 280, borderRadius: 14, backgroundColor: '#fff' },
  memeTitleLarge: { fontSize: 15, fontWeight: '600', color: '#78350F', marginTop: 12 },

  waiting: { textAlign: 'center', color: '#6B7280', marginTop: 20, fontStyle: 'italic' },

  btnPrimary: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  btnSecondary: { backgroundColor: '#EFF6FF', borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  btnSecondaryText: { fontSize: 15, color: '#2563EB', fontWeight: '600' },

  bigTitle: { fontSize: 32, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 16, color: '#6B7280', marginTop: 8 },
  podium: { marginTop: 24 },
  podiumRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#FFFFFF',
    borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8,
  },
  podiumRowWinner: {
    backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 2,
  },
  podiumPlace: { fontSize: 20, fontWeight: '700', color: '#2563EB', width: 40 },
  podiumName: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  podiumScore: { fontSize: 14, fontWeight: '700', color: '#2563EB' },

  // Waiting indicator
  waitingBox: {
    backgroundColor: '#F3F4F6', borderRadius: 12, padding: 12, marginTop: 12,
  },
  waitingText: {
    fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 8,
  },
  waitingAvatars: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  waitingAvatarWrap: { alignItems: 'center', minWidth: 50 },
  waitingName: { fontSize: 10, color: '#374151', marginTop: 4, fontWeight: '500' },

  // Vote breakdown in reveal
  voteBreakdownRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  voteBreakdownLabel: {
    fontSize: 11, fontWeight: '700', color: '#2563EB',
    letterSpacing: 0.5, marginRight: 8,
  },
  voterChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EFF6FF', borderRadius: 12,
    paddingVertical: 3, paddingHorizontal: 6,
    marginRight: 6, marginBottom: 4,
  },
  voterName: { fontSize: 11, color: '#1E40AF', marginLeft: 4, fontWeight: '600' },
});
