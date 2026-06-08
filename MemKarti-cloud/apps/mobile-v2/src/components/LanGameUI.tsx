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
import { reportBadMeme } from '@/game/qa';
import { HandPicker } from './HandPicker';
import { DropIn, FadeIn } from './RevealAnimation';
import { Avatar } from './Avatar';
import { PhaseTimer } from './PhaseTimer';
import { Confetti } from './Confetti';
import { FlipCard } from './FlipCard';
import { useTheme } from '@/ThemeProvider';
import { selectHaptic, winHaptic } from '@/game/haptics';
import { playSound } from '@/game/sounds';

type Props = {
  view: ClientView;
  insets: { top: number; bottom: number };
  isHost: boolean;
  onSubmit: (memeCardId: number) => void;
  onVote: (submissionId: string) => void;
  onNextRound: () => void;
  onExit: () => void;
  onRematch?: () => void; // только для хоста / соло
  // Заменить «поганий» мем в руке (фаза pick). Если не передан — кнопка скрыта.
  onReplaceCard?: (memeCardId: number) => void;
};

export function LanGameUI({ view, insets, isHost, onSubmit, onVote, onNextRound, onExit, onRematch, onReplaceCard }: Props) {
  const { colors, isDark } = useTheme();

  // Play sound + haptic on phase transitions
  const prevPhaseRef = useRef(view.phase);
  useEffect(() => {
    if (prevPhaseRef.current !== view.phase) {
      if (view.phase === 'reveal') {
        winHaptic();
        playSound('roundWin');
      }
      if (view.phase === 'finished') {
        winHaptic();
        playSound('gameWin');
      }
      prevPhaseRef.current = view.phase;
    }
  }, [view.phase]);

  // ============= FINISHED =============
  if (view.phase === 'finished') {
    const sorted = [...view.players].sort((a, b) => b.score - a.score);
    const top = sorted[0];
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 24 }]}>
        <Confetti />
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={[styles.bigTitle, { color: colors.text }]}>🏆 Гру завершено</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Переможець: <Text style={[styles.winnerName, { color: colors.winnerText }]}>{top?.nickname ?? '—'}</Text>
          </Text>
          <View style={styles.podium}>
            {sorted.map((p, i) => (
              <View key={p.id} style={[styles.podiumRow, { backgroundColor: colors.cardBg, borderColor: colors.border }, i === 0 && { backgroundColor: colors.winnerBg, borderColor: colors.winnerBorder, borderWidth: 2 }]}>
                <Text style={[styles.podiumPlace, { color: i === 0 ? colors.winnerText : colors.primary }]}>
                  {i === 0 ? '👑' : `${i + 1}.`}
                </Text>
                <View style={{ marginRight: 10 }}>
                  <Avatar id={p.id} nickname={p.nickname} size={36} border={i === 0} />
                </View>
                <Text style={[styles.podiumName, { color: colors.text }]}>{p.nickname}</Text>
                <Text style={[styles.podiumScore, { color: i === 0 ? colors.winnerText : colors.primary }]}>
                  {p.score} оч.
                </Text>
              </View>
            ))}
          </View>
          {isHost && onRematch && (
            <TouchableOpacity onPress={onRematch} style={[styles.btnPrimary, { backgroundColor: colors.primary, marginTop: 24 }]}>
              <Text style={styles.btnPrimaryText}>🔄 Реванш — ще раз</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onExit}
            style={[isHost && onRematch ? { ...styles.btnSecondary, backgroundColor: colors.btnSecondaryBg } : { ...styles.btnPrimary, backgroundColor: colors.primary }, { marginTop: 12 }]}
          >
            <Text style={isHost && onRematch ? [styles.btnSecondaryText, { color: colors.primaryText }] : styles.btnPrimaryText}>
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
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <RoundHeader view={view} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>СИТУАЦІЯ</Text>
          <Text style={[styles.situation, { backgroundColor: colors.situationBg, color: colors.situationText }]}>{view.situation?.text_ua}</Text>

          {winnerSub && winnerPlayer ? (
            <FadeIn delay={view.submissions.length * 200 + 400}>
              <Pulse>
                <View style={[styles.winnerCard, { backgroundColor: colors.winnerBg }]}>
                  <Text style={[styles.winnerLabel, { color: colors.winnerText }]}>👑 ПЕРЕМОЖЕЦЬ РАУНДУ</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Avatar id={winnerPlayer.id} nickname={winnerPlayer.nickname} size={48} border />
                    <Text style={[styles.winnerName, { marginLeft: 12, marginBottom: 0, color: colors.winnerText }]}>
                      {winnerPlayer.nickname}
                    </Text>
                  </View>
                  <Image source={{ uri: winnerSub.memeCard.image_url }} style={styles.bigImg} />
                  <Text style={[styles.memeTitleLarge, { color: colors.winnerText }]}>{winnerSub.memeCard.title}</Text>
                </View>
              </Pulse>
            </FadeIn>
          ) : null}

          <Text style={[styles.label, { marginTop: 24, color: colors.textSecondary }]}>УСІ ВАРІАНТИ</Text>
          {view.submissions.map((sub, i) => {
            const player = view.players.find((p) => p.id === sub.playerId);
            const isWinner = sub.id === view.roundWinner?.submissionId;
            const voters = (view.voteBreakdown[sub.id] ?? [])
              .map((vid) => view.players.find((p) => p.id === vid))
              .filter(Boolean) as typeof view.players;
            return (
              <DropIn key={sub.id} delay={i * 200}>
                <View style={[styles.bigSubCard, { backgroundColor: colors.cardBg, borderColor: colors.border }, isWinner && { borderColor: colors.winnerBorder, borderWidth: 3, backgroundColor: colors.winnerBg }]}>
                  <Image source={{ uri: sub.memeCard.image_url }} style={styles.bigSubImg} />
                  <View style={styles.bigSubMeta}>
                    <Text style={[styles.bigSubTitle, { color: colors.text }]} numberOfLines={2}>{sub.memeCard.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                      <Avatar id={sub.playerId} nickname={player?.nickname ?? '?'} size={20} />
                      <Text style={[styles.bigSubPlayer, { marginLeft: 6, color: colors.textSecondary }]}>
                        від {player?.nickname ?? '?'}
                      </Text>
                    </View>
                    {voters.length > 0 && (
                      <View style={[styles.voteBreakdownRow, { borderTopColor: colors.border }]}>
                        <Text style={[styles.voteBreakdownLabel, { color: colors.primary }]}>
                          {voters.length} {voters.length === 1 ? 'голос' : 'голоси'}:
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', flex: 1 }}>
                          {voters.map((v) => (
                            <View key={v.id} style={[styles.voterChip, { backgroundColor: colors.primaryLight }]}>
                              <Avatar id={v.id} nickname={v.nickname} size={18} />
                              <Text style={[styles.voterName, { color: colors.primaryText }]}>{v.nickname}</Text>
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

          <Text style={[styles.label, { marginTop: 24, color: colors.textSecondary }]}>РАХУНОК</Text>
          {view.players.map((p) => (
            <View key={p.id} style={[styles.scoreRow, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Avatar id={p.id} nickname={p.nickname} size={32} />
                <Text style={[styles.scoreName, { marginLeft: 10, color: colors.text }]}>
                  {p.nickname}
                  {p.id === view.myId ? ' (ти)' : ''}
                </Text>
              </View>
              <Text style={[styles.scoreVal, { color: colors.primary }]}>★ {p.score}</Text>
            </View>
          ))}

          {isHost ? (
            <TouchableOpacity onPress={onNextRound} style={[styles.btnPrimary, { backgroundColor: colors.primary, marginTop: 24 }]}>
              <Text style={styles.btnPrimaryText}>
                {view.round >= view.totalRounds ? 'Подивитись фінал' : 'Наступний раунд →'}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.waiting, { color: colors.textSecondary }]}>Чекаємо хоста для наступного раунду…</Text>
          )}
        </ScrollView>
      </View>
    );
  }

  // ============= VOTE =============
  if (view.phase === 'vote') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <RoundHeader view={view} />
          {!view.myVotedSubmissionId && (
            <PhaseTimer
              resetKey={`vote-${view.round}`}
              totalSec={view.voteSeconds}
              label="на голосування"
            />
          )}
          <Text style={[styles.label, { color: colors.textSecondary }]}>СИТУАЦІЯ</Text>
          <Text style={[styles.situation, { backgroundColor: colors.situationBg, color: colors.situationText }]}>{view.situation?.text_ua}</Text>

          <Text style={[styles.label, { marginTop: 24, color: colors.textSecondary }]}>ОБЕРИ НАЙСМІШНІШИЙ (можна і за свій)</Text>
          <WaitingFor view={view} verb="голосує" />
          {view.submissions.map((sub, i) => {
            const voted = view.myVotedSubmissionId === sub.id;
            const isMine = sub.playerId === view.myId;
            return (
              <TouchableOpacity
                key={sub.id}
                disabled={!!view.myVotedSubmissionId}
                onPress={() => {
                  selectHaptic();
                  playSound('vote');
                  onVote(sub.id);
                }}
                activeOpacity={0.85}
                style={[styles.bigSubCardWrap, voted && { borderColor: colors.primary, borderWidth: 3, backgroundColor: colors.primaryLight }]}
              >
                <FlipCard
                  imageUrl={sub.memeCard.image_url}
                  title={sub.memeCard.title}
                  height={260}
                  delay={i * 400 + 200}
                />
                <View style={styles.bigSubMeta}>
                  {isMine && <Text style={[styles.bigSubPlayer, { color: colors.textSecondary }]}>(твій вибір)</Text>}
                  {voted && <Text style={[styles.votedBadge, { color: colors.primary }]}>✓ Твій голос</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
          {view.myVotedSubmissionId && (
            <Text style={[styles.waiting, { color: colors.textSecondary }]}>Голос прийнято. Чекаємо інших…</Text>
          )}
        </ScrollView>
      </View>
    );
  }

  // ============= PICK =============
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <RoundHeader view={view} />
        {!view.myPickedSubmissionId && (
          <PhaseTimer
            resetKey={`pick-${view.round}`}
            totalSec={view.pickSeconds}
            label="на вибір мема"
          />
        )}
        <Text style={[styles.label, { color: colors.textSecondary }]}>СИТУАЦІЯ</Text>
        <Text style={[styles.situation, { backgroundColor: colors.situationBg, color: colors.situationText }]}>{view.situation?.text_ua}</Text>

        <Text style={[styles.label, { marginTop: 20, marginBottom: 4, color: colors.textSecondary }]}>
          ТВОЯ РУКА · ГОРТАЙ ТА ОБЕРИ
        </Text>

        <WaitingFor view={view} verb="обирає" />
      </ScrollView>

      <View style={{ marginHorizontal: -16 }}>
        <HandPicker
          hand={view.myHand}
          onPick={(id) => onSubmit(id)}
          disabled={!!view.myPickedSubmissionId}
          onFlagBad={
            onReplaceCard
              ? (card) => {
                  // Улетает на сервер для курації колоди (best-effort).
                  reportBadMeme(card, { phase: 'pick', situation: view.situation?.text_ua });
                  // И сразу меняем карту в руке на нову.
                  onReplaceCard(card.id);
                }
              : undefined
          }
        />
      </View>
    </View>
  );
}

function RoundHeader({ view }: { view: ClientView }) {
  const { colors } = useTheme();
  return (
    <View style={styles.roundHeader}>
      <Text style={[styles.roundText, { color: colors.textSecondary }]}>
        Раунд {view.round} / {view.totalRounds}
      </Text>
      <Text style={[styles.roundText, { color: colors.textSecondary }]}>{view.players.length} гравців</Text>
    </View>
  );
}

// Индикатор: чьего хода ещё ждём.
function WaitingFor({ view, verb }: { view: ClientView; verb: string }) {
  const { colors } = useTheme();
  const done = new Set(view.doneInPhase);
  const waiting = view.players.filter((p) => !done.has(p.id));
  if (waiting.length === 0) return null;
  return (
    <View style={[styles.waitingBox, { backgroundColor: isDark(colors) ? colors.surface : '#F3F4F6' }]}>
      <Text style={[styles.waitingText, { color: colors.textSecondary }]}>Ще {verb}:</Text>
      <View style={styles.waitingAvatars}>
        {waiting.map((p) => (
          <View key={p.id} style={styles.waitingAvatarWrap}>
            <Avatar id={p.id} nickname={p.nickname} size={28} />
            <Text style={[styles.waitingName, { color: colors.textSecondary }]}>{p.nickname}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Helper: check if dark based on colors
function isDark(colors: { background: string }): boolean {
  return colors.background === '#111827';
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
  container: { flex: 1 },
  roundHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  roundText: { fontSize: 13, fontWeight: '500' },

  label: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  situation: { fontSize: 17, fontWeight: '600', padding: 18, borderRadius: 14, lineHeight: 24 },

  // Big submission cards (vote and reveal phase)
  bigSubCard: {
    borderRadius: 14, marginBottom: 14,
    borderWidth: 1, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  bigSubCardWrap: {
    marginBottom: 14, borderRadius: 14, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  bigSubImg: { width: '100%', height: 260, backgroundColor: '#F3F4F6' },
  bigSubMeta: { padding: 12 },
  bigSubTitle: { fontSize: 14, fontWeight: '600' },
  bigSubPlayer: { fontSize: 12, marginTop: 4 },
  votedBadge: { fontSize: 12, fontWeight: '700', marginTop: 4 },

  scoreRow: {
    flexDirection: 'row', justifyContent: 'space-between', padding: 12,
    borderWidth: 1, borderRadius: 10, marginBottom: 6,
  },
  scoreName: { fontSize: 14, fontWeight: '600' },
  scoreVal: { fontSize: 14, fontWeight: '700' },

  winnerCard: {
    borderRadius: 18, padding: 18,
    marginTop: 16, alignItems: 'center',
  },
  winnerLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  winnerName: { fontSize: 24, fontWeight: '800', marginBottom: 12 },
  bigImg: { width: '100%', height: 280, borderRadius: 14, backgroundColor: '#fff' },
  memeTitleLarge: { fontSize: 15, fontWeight: '600', marginTop: 12 },

  waiting: { textAlign: 'center', marginTop: 20, fontStyle: 'italic' },

  btnPrimary: { borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  btnSecondary: { borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  btnSecondaryText: { fontSize: 15, fontWeight: '600' },

  bigTitle: { fontSize: 32, fontWeight: '700' },
  sub: { fontSize: 16, marginTop: 8 },
  podium: { marginTop: 24 },
  podiumRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 10, borderWidth: 1, marginBottom: 8,
  },
  podiumPlace: { fontSize: 20, fontWeight: '700', width: 40 },
  podiumName: { fontSize: 16, fontWeight: '600', flex: 1 },
  podiumScore: { fontSize: 14, fontWeight: '700' },

  // Waiting indicator
  waitingBox: {
    borderRadius: 12, padding: 12, marginTop: 12,
  },
  waitingText: {
    fontSize: 12, fontWeight: '600', marginBottom: 8,
  },
  waitingAvatars: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  waitingAvatarWrap: { alignItems: 'center', minWidth: 50 },
  waitingName: { fontSize: 10, marginTop: 4, fontWeight: '500' },

  // Vote breakdown in reveal
  voteBreakdownRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1,
  },
  voteBreakdownLabel: {
    fontSize: 11, fontWeight: '700',
    letterSpacing: 0.5, marginRight: 8,
  },
  voterChip: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 3, paddingHorizontal: 6,
    marginRight: 6, marginBottom: 4,
  },
  voterName: { fontSize: 11, marginLeft: 4, fontWeight: '600' },

  // QA flag button
  flagBtn: {
    alignSelf: 'flex-start', marginTop: 10,
    borderWidth: 1,
    borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10,
  },
  flagBtnText: { fontSize: 12, fontWeight: '600' },
  flagBtnDone: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  flagBtnTextDone: { color: '#6B7280' },
});
