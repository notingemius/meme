import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../theme/theme';
import type { ClientView } from '../game/engine/engine';
import type { ClientAction } from '../game/net/protocol';
import { memeAsset } from '../game/engine/memeAssets';

// Картинка мема: спершу локальний ассет (зашитий в APK) за id картки,
// інакше — fallback на віддалений URL з індикатором завантаження.
function MemeImage({ cardId, uri }: { cardId: number; uri: string }) {
  const local = memeAsset(cardId);
  const [loading, setLoading] = useState(!local);
  const [failed, setFailed] = useState(false);

  if (local) {
    return (
      <View style={styles.memeImgWrap}>
        <Image source={local} style={styles.memeImg} resizeMode="cover" />
      </View>
    );
  }
  return (
    <View style={styles.memeImgWrap}>
      {loading && !failed && (
        <View style={styles.memeLoader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      {failed ? (
        <View style={styles.memeLoader}>
          <Text style={styles.memeFailEmoji}>🖼️</Text>
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={styles.memeImg}
          resizeMode="cover"
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
        />
      )}
    </View>
  );
}

type Props = {
  view: ClientView;
  error: string | null;
  send: (a: ClientAction) => void;
};

export default function GameView({ view, error, send }: Props) {
  const judge = view.players.find((p) => p.id === view.currentJudgeId);

  return (
    <View style={styles.root}>
      {/* Scoreboard */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scoreBar}
        contentContainerStyle={styles.scoreBarContent}
      >
        {view.players.map((p) => (
          <View key={p.id} style={styles.scoreChip}>
            <View style={[styles.scoreDot, { backgroundColor: p.avatarColor }]} />
            <Text style={styles.scoreName}>{p.nickname}</Text>
            <Text style={styles.scoreVal}>{p.score}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.roundRow}>
        <Text style={styles.roundText}>Раунд {view.round}</Text>
        <Text style={styles.judgeText}>
          Суддя: {judge?.nickname ?? '—'} {view.isJudge ? '(ти)' : ''}
        </Text>
      </View>

      {/* Situation */}
      <View style={styles.situationCard}>
        <Text style={styles.situationLabel}>СИТУАЦІЯ</Text>
        <Text style={styles.situationText}>
          {view.language === 'ru' ? view.situation?.text_ru : view.situation?.text_ua}
        </Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {/* Body: playing (pick meme) / judging (pick winner) */}
      {view.phase === 'playing' ? (
        <PlayingBody view={view} send={send} />
      ) : (
        <JudgingBody view={view} send={send} />
      )}
    </View>
  );
}

function PlayingBody({ view, send }: { view: ClientView; send: (a: ClientAction) => void }) {
  if (view.isJudge) {
    return (
      <View style={styles.centerBody}>
        <Text style={styles.waitEmoji}>⚖️</Text>
        <Text style={styles.waitText}>Ти суддя цього раунду.</Text>
        <Text style={styles.waitSub}>Зачекай, поки гравці оберуть меми…</Text>
        <Text style={styles.progress}>
          Обрали: {view.submissions.length}/{view.players.filter((p) => p.isActive).length - 1}
        </Text>
      </View>
    );
  }
  if (view.hasSubmitted) {
    return (
      <View style={styles.centerBody}>
        <Text style={styles.waitEmoji}>✅</Text>
        <Text style={styles.waitText}>Мем надіслано!</Text>
        <Text style={styles.waitSub}>Чекаємо інших гравців…</Text>
      </View>
    );
  }
  return (
    <>
      <Text style={styles.handLabel}>ОБЕРИ НАЙСМІШНІШИЙ МЕМ</Text>
      <ScrollView contentContainerStyle={styles.handGrid}>
        {view.myHand.map((card) => (
          <TouchableOpacity
            key={card.id}
            style={styles.memeCard}
            activeOpacity={0.8}
            onPress={() => send({ type: 'submit', memeCardId: card.id })}
          >
            <MemeImage cardId={card.id} uri={card.image_url} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );
}

function JudgingBody({ view, send }: { view: ClientView; send: (a: ClientAction) => void }) {
  return (
    <>
      <Text style={styles.handLabel}>
        {view.isJudge ? 'ОБЕРИ ПЕРЕМОЖЦЯ РАУНДУ' : 'СУДДЯ ОБИРАЄ ПЕРЕМОЖЦЯ…'}
      </Text>
      <ScrollView contentContainerStyle={styles.handGrid}>
        {view.submissions.map((sub) => (
          <TouchableOpacity
            key={sub.id}
            style={[styles.memeCard, sub.isWinner && styles.memeWinner]}
            activeOpacity={view.isJudge ? 0.8 : 1}
            disabled={!view.isJudge}
            onPress={() => view.isJudge && send({ type: 'judge', submissionId: sub.id })}
          >
            <MemeImage cardId={sub.memeCardId} uri={sub.image_url} />
            {sub.isMine && (
              <View style={styles.mineTag}>
                <Text style={styles.mineTagText}>твій</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.lg },
  scoreBar: { maxHeight: 56, marginBottom: spacing.sm },
  scoreBarContent: { gap: spacing.sm, alignItems: 'center', paddingVertical: spacing.sm },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: 6,
  },
  scoreDot: { width: 10, height: 10, borderRadius: 5 },
  scoreName: { color: colors.textDim, fontSize: 13 },
  scoreVal: { color: colors.text, fontSize: 14, fontWeight: '800' },
  roundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  roundText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  judgeText: { color: colors.textDim, fontSize: 13 },
  situationCard: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  situationLabel: { color: '#C7D2FE', fontSize: 11, letterSpacing: 1, marginBottom: 6 },
  situationText: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 24 },
  error: { color: colors.danger, textAlign: 'center', marginBottom: spacing.sm },
  centerBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  waitEmoji: { fontSize: 48, marginBottom: spacing.md },
  waitText: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  waitSub: { color: colors.textDim, fontSize: 14, marginTop: spacing.sm, textAlign: 'center' },
  progress: { color: colors.primary, fontSize: 14, marginTop: spacing.lg, fontWeight: '600' },
  handLabel: { color: colors.textFaint, fontSize: 12, letterSpacing: 1, marginBottom: spacing.sm },
  handGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
  },
  memeCard: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  memeWinner: { borderColor: colors.success, borderWidth: 3 },
  memeImgWrap: { width: '100%', height: '100%', backgroundColor: colors.bgAlt },
  memeImg: { width: '100%', height: '100%' },
  memeLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memeFailEmoji: { fontSize: 36 },
  mineTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  mineTagText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
