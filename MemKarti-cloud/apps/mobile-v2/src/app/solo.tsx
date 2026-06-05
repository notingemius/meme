import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  createSoloGame,
  pickCard,
  nextRound,
  type SoloGameState,
} from '@/game/soloEngine';

export default function SoloScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ nickname?: string }>();
  const nickname = params.nickname || 'Гравець';

  const [game, setGame] = useState<SoloGameState>(() => createSoloGame());

  const round = game.rounds[game.currentRoundIndex];
  const isShowingResult = !!round?.picked;

  const handlePick = useCallback(
    (memeId: number) => {
      setGame((s) => pickCard(s, memeId));
    },
    [],
  );

  const handleNext = useCallback(() => {
    setGame((s) => nextRound(s));
  }, []);

  const handleNewGame = useCallback(() => {
    setGame(createSoloGame());
  }, []);

  // === ИТОГ ===
  if (game.isFinished) {
    const max = game.rounds.length * 3;
    const pct = max > 0 ? (game.totalScore / max) * 100 : 0;
    const verdict =
      pct >= 80 ? 'Король мемів! 👑'
      : pct >= 60 ? 'Майстер сарказму 🔥'
      : pct >= 40 ? 'Норм, треба тренуватись 😎'
      : 'Ще трохи практики 💪';

    return (
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.title}>Гру завершено</Text>
          <Text style={styles.subtitle}>{nickname}</Text>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Очки</Text>
            <Text style={styles.scoreValue}>
              {game.totalScore} / {max}
            </Text>
            <Text style={styles.verdict}>{verdict}</Text>
          </View>

          <View style={{ marginTop: 24 }}>
            <Text style={styles.sectionLabel}>ТВОЇ ВИБОРИ</Text>
            {game.rounds.map((r, i) => (
              <View key={i} style={styles.historyItem}>
                <Text style={styles.historySituation} numberOfLines={2}>
                  {i + 1}. {r.situation.text_ua}
                </Text>
                {r.picked && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <Image source={{ uri: r.picked.image_url }} style={styles.historyImage} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.historyMemeTitle}>{r.picked.title}</Text>
                      <Text style={styles.historyScore}>+{r.score} очок</Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>

          <TouchableOpacity onPress={handleNewGame} style={[styles.btnPrimary, { marginTop: 24 }]}>
            <Text style={styles.btnPrimaryText}>Ще раз</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.btnSecondary, { marginTop: 12 }]}
          >
            <Text style={styles.btnSecondaryText}>На головну</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // === ИГРОВОЙ РАУНД ===
  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Вийти</Text>
          </TouchableOpacity>
          <Text style={styles.headerInfo}>
            Раунд {game.currentRoundIndex + 1} / {game.rounds.length}
          </Text>
          <Text style={styles.headerInfo}>★ {game.totalScore}</Text>
        </View>

        <View style={styles.situationCard}>
          <Text style={styles.situationLabel}>СИТУАЦІЯ</Text>
          <Text style={styles.situationText}>{round.situation.text_ua}</Text>
        </View>

        {!isShowingResult ? (
          <>
            <Text style={styles.sectionLabel}>ОБЕРИ МЕМ</Text>
            {round.hand.map((meme) => (
              <TouchableOpacity
                key={meme.id}
                onPress={() => handlePick(meme.id)}
                style={styles.memeCard}
              >
                <Image source={{ uri: meme.image_url }} style={styles.memeImage} />
                <Text style={styles.memeTitle} numberOfLines={2}>
                  {meme.title}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <View style={styles.resultBlock}>
            <Text style={styles.resultLabel}>ТВІЙ ВИБІР</Text>
            <View style={styles.memeCardPicked}>
              <Image source={{ uri: round.picked!.image_url }} style={styles.memeImageBig} />
              <Text style={styles.memeTitlePicked}>{round.picked!.title}</Text>
            </View>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreBadgeText}>+{round.score} очок</Text>
              <Text style={styles.scoreBadgeNote}>
                {round.score === 3 ? '🔥 Огонь!'
                : round.score === 2 ? '😄 Норм'
                : round.score === 1 ? '🙂 Так собі'
                : '😐 Не зайшло'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleNext} style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>
                {game.currentRoundIndex + 1 >= game.rounds.length
                  ? 'Подивитись результат'
                  : 'Наступний раунд →'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  backBtnText: { color: '#2563EB', fontSize: 14, fontWeight: '600' },
  headerInfo: { color: '#6B7280', fontSize: 13, fontWeight: '500' },

  situationCard: {
    backgroundColor: '#2563EB', borderRadius: 16, padding: 20, marginBottom: 24,
  },
  situationLabel: { color: '#BFDBFE', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  situationText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', lineHeight: 25 },

  sectionLabel: { color: '#6B7280', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 12 },

  memeCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    marginBottom: 12, overflow: 'hidden',
  },
  memeImage: { width: '100%', height: 180, backgroundColor: '#F3F4F6' },
  memeTitle: { fontSize: 14, color: '#111827', padding: 12, fontWeight: '500' },

  resultBlock: { alignItems: 'stretch' },
  resultLabel: { color: '#6B7280', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 12 },
  memeCardPicked: {
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 2, borderColor: '#2563EB',
    overflow: 'hidden', marginBottom: 16,
  },
  memeImageBig: { width: '100%', height: 280, backgroundColor: '#F3F4F6' },
  memeTitlePicked: { fontSize: 15, color: '#111827', padding: 14, fontWeight: '600' },

  scoreBadge: {
    backgroundColor: '#FEF3C7', borderRadius: 12, padding: 16,
    alignItems: 'center', marginBottom: 16,
  },
  scoreBadgeText: { fontSize: 28, color: '#92400E', fontWeight: '700' },
  scoreBadgeNote: { fontSize: 15, color: '#78350F', marginTop: 4 },

  btnPrimary: {
    backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryText: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  btnSecondary: {
    backgroundColor: '#EFF6FF', borderRadius: 10, paddingVertical: 16,
    alignItems: 'center',
  },
  btnSecondaryText: { fontSize: 15, color: '#2563EB', fontWeight: '600' },

  // === финал ===
  title: { fontSize: 32, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 15, color: '#6B7280', marginTop: 4 },
  scoreCard: {
    backgroundColor: '#2563EB', borderRadius: 20, padding: 24, marginTop: 24, alignItems: 'center',
  },
  scoreLabel: { color: '#BFDBFE', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  scoreValue: { color: '#FFFFFF', fontSize: 56, fontWeight: '700', marginVertical: 8 },
  verdict: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  historyItem: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  historySituation: { fontSize: 13, color: '#374151', fontWeight: '500' },
  historyImage: { width: 60, height: 60, borderRadius: 6, backgroundColor: '#F3F4F6' },
  historyMemeTitle: { fontSize: 13, color: '#111827', fontWeight: '600' },
  historyScore: { fontSize: 12, color: '#2563EB', fontWeight: '600', marginTop: 2 },
});
