import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../theme/theme';
import type { ClientView } from '../game/engine/engine';
import type { ClientAction } from '../game/net/protocol';
import { memeAsset } from '../game/engine/memeAssets';

function WinnerImage({ cardId, uri }: { cardId: number; uri: string }) {
  const local = memeAsset(cardId);
  const [loading, setLoading] = useState(!local);
  return (
    <View style={styles.winnerImg}>
      {loading && (
        <View style={styles.winnerLoader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      <Image
        source={local ?? { uri }}
        style={styles.winnerImgInner}
        resizeMode="cover"
        onLoadEnd={() => setLoading(false)}
      />
    </View>
  );
}

type Props = {
  view: ClientView;
  send: (a: ClientAction) => void;
  onExit: () => void;
};

export default function ResultsView({ view, send, onExit }: Props) {
  const finished = view.phase === 'finished';
  const sorted = [...view.players].sort((a, b) => b.score - a.score);
  const winnerSub = view.submissions.find((s) => s.isWinner);
  const champion = sorted[0];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.bigEmoji}>{finished ? '🏆' : '🎉'}</Text>
        <Text style={styles.title}>
          {finished ? 'Гру завершено!' : 'Раунд завершено'}
        </Text>

        {finished ? (
          <Text style={styles.champion}>
            Чемпіон: {champion?.nickname} ({champion?.score} очк.)
          </Text>
        ) : (
          winnerSub && (
            <View style={styles.winnerCard}>
              <Text style={styles.winnerLabel}>ПЕРЕМОЖНИЙ МЕМ</Text>
              <WinnerImage cardId={winnerSub.memeCardId} uri={winnerSub.image_url} />
              {winnerSub.nickname && (
                <Text style={styles.winnerAuthor}>від {winnerSub.nickname}</Text>
              )}
            </View>
          )
        )}

        <Text style={styles.sectionLabel}>ТАБЛИЦЯ</Text>
        {sorted.map((p, i) => (
          <View key={p.id} style={styles.scoreRow}>
            <Text style={styles.rank}>{i + 1}</Text>
            <View style={[styles.dot, { backgroundColor: p.avatarColor }]} />
            <Text style={styles.name}>{p.nickname}</Text>
            <Text style={styles.score}>{p.score}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {finished ? (
          <TouchableOpacity style={styles.exitBtn} onPress={onExit} activeOpacity={0.85}>
            <Text style={styles.exitBtnText}>У меню</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.autoHint}>Наступний раунд почнеться автоматично…</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.xl, alignItems: 'center' },
  bigEmoji: { fontSize: 64, marginTop: spacing.lg },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: spacing.sm, textAlign: 'center' },
  champion: { color: colors.warning, fontSize: 18, fontWeight: '700', marginTop: spacing.md, textAlign: 'center' },
  winnerCard: {
    width: '100%',
    backgroundColor: colors.bgAlt,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  winnerLabel: { color: colors.textFaint, fontSize: 12, letterSpacing: 1, marginBottom: spacing.md },
  winnerImg: { width: 200, height: 200, borderRadius: radius.md, backgroundColor: colors.bg, overflow: 'hidden' },
  winnerImgInner: { width: '100%', height: '100%' },
  winnerLoader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  winnerAuthor: { color: colors.textDim, fontSize: 14, marginTop: spacing.md },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: 12,
    letterSpacing: 1,
    alignSelf: 'flex-start',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    width: '100%',
  },
  rank: { color: colors.textFaint, fontSize: 16, fontWeight: '800', width: 24 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: spacing.md },
  name: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  score: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  footer: { padding: spacing.xl },
  exitBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  exitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  autoHint: { color: colors.textDim, textAlign: 'center', fontSize: 14 },
});
