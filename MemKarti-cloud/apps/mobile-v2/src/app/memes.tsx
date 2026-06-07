// ============================================================================
// QA review screen — browse ALL memes and flag the bad ones.
// ----------------------------------------------------------------------------
// Shows every meme in the deck in a grid. Tap a card to toggle "bad" — it's
// sent to the server (idempotent /qa/flag with by:"review", or /qa/unflag).
// Already-flagged memes are pre-loaded from /qa/flagged-ids so the curated set
// survives across sessions/devices.
// ============================================================================
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { MEME_CARDS, type MemeCard } from '@/game/deck';
import { reportBadMeme, fetchFlaggedIds, unflagMeme } from '@/game/qa';

const { width } = Dimensions.get('window');
const COLS = 2;
const GAP = 10;
const PAD = 16;
const CARD_W = (width - PAD * 2 - GAP * (COLS - 1)) / COLS;

export default function MemesReviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState<MemeCard | null>(null);

  // Load the already-flagged set from the server on mount.
  useEffect(() => {
    (async () => {
      const ids = await fetchFlaggedIds();
      setFlagged(ids);
      setLoading(false);
    })();
  }, []);

  const toggle = useCallback(
    async (meme: MemeCard) => {
      const isFlagged = flagged.has(meme.id);
      // optimistic update
      setFlagged((prev) => {
        const next = new Set(prev);
        if (isFlagged) next.delete(meme.id);
        else next.add(meme.id);
        return next;
      });
      setBusy((prev) => new Set(prev).add(meme.id));
      const ok = isFlagged
        ? await unflagMeme(meme.id)
        : await reportBadMeme(meme, { by: 'review' });
      // revert on failure
      if (!ok) {
        setFlagged((prev) => {
          const next = new Set(prev);
          if (isFlagged) next.add(meme.id);
          else next.delete(meme.id);
          return next;
        });
      }
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(meme.id);
        return next;
      });
    },
    [flagged],
  );

  const data = useMemo(
    () => (onlyFlagged ? MEME_CARDS.filter((m) => flagged.has(m.id)) : MEME_CARDS),
    [onlyFlagged, flagged],
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹ Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Усі меми ({MEME_CARDS.length})</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Text style={styles.counter}>
          🚩 Позначено: <Text style={{ fontWeight: '700', color: '#B91C1C' }}>{flagged.size}</Text>
        </Text>
        <TouchableOpacity
          onPress={() => setOnlyFlagged((v) => !v)}
          style={[styles.filterBtn, onlyFlagged && styles.filterBtnActive]}
        >
          <Text style={[styles.filterText, onlyFlagged && styles.filterTextActive]}>
            {onlyFlagged ? '✓ Тільки позначені' : 'Тільки позначені'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>Тап — позначити/зняти. Утримуй — переглянути на весь екран.</Text>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={{ color: '#6B7280', marginTop: 12 }}>Завантажую позначені…</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(m) => String(m.id)}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: PAD }}
          contentContainerStyle={{ gap: GAP, paddingVertical: 12, paddingBottom: insets.bottom + 24 }}
          initialNumToRender={10}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>
              Поки нічого не позначено
            </Text>
          }
          renderItem={({ item }) => {
            const isFlagged = flagged.has(item.id);
            const isBusy = busy.has(item.id);
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => toggle(item)}
                onLongPress={() => setPreview(item)}
                style={[styles.card, { width: CARD_W }, isFlagged && styles.cardFlagged]}
              >
                <Image source={{ uri: item.image_url }} style={styles.img} resizeMode="cover" />
                <View style={styles.cardFooter}>
                  <Text numberOfLines={1} style={styles.cardTitle}>
                    {item.id}. {item.title}
                  </Text>
                </View>
                <View style={[styles.badge, isFlagged ? styles.badgeOn : styles.badgeOff]}>
                  {isBusy ? (
                    <ActivityIndicator size="small" color={isFlagged ? '#FFFFFF' : '#9CA3AF'} />
                  ) : (
                    <Text style={styles.badgeText}>{isFlagged ? '🚩' : '🏳️'}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Fullscreen preview */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.modalBg} onPress={() => setPreview(null)}>
          {preview && (
            <View style={styles.modalCard}>
              <Image source={{ uri: preview.image_url }} style={styles.modalImg} resizeMode="contain" />
              <Text style={styles.modalTitle}>
                {preview.id}. {preview.title}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  toggle(preview);
                  setPreview(null);
                }}
                style={[styles.modalBtn, flagged.has(preview.id) ? styles.modalBtnUnflag : styles.modalBtnFlag]}
              >
                <Text style={styles.modalBtnText}>
                  {flagged.has(preview.id) ? '✓ Зняти позначку' : '🚩 Позначити як поганий'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: PAD, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  back: { fontSize: 16, color: '#2563EB', fontWeight: '600', width: 60 },
  title: { fontSize: 16, color: '#111827', fontWeight: '700' },

  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: PAD, paddingTop: 12,
  },
  counter: { fontSize: 14, color: '#374151' },
  filterBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF',
  },
  filterBtnActive: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  filterText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  filterTextActive: { color: '#B91C1C' },

  hint: { fontSize: 12, color: '#9CA3AF', paddingHorizontal: PAD, paddingTop: 6 },

  card: {
    borderRadius: 12, overflow: 'hidden', backgroundColor: '#F9FAFB',
    borderWidth: 2, borderColor: 'transparent',
  },
  cardFlagged: { borderColor: '#EF4444' },
  img: { width: '100%', height: CARD_W * 0.78, backgroundColor: '#E5E7EB' },
  cardFooter: { paddingHorizontal: 8, paddingVertical: 8 },
  cardTitle: { fontSize: 12, color: '#374151', fontWeight: '500' },
  badge: {
    position: 'absolute', top: 6, right: 6, width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeOn: { backgroundColor: '#EF4444' },
  badgeOff: { backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: '#E5E7EB' },
  badgeText: { fontSize: 14 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', alignItems: 'center' },
  modalImg: { width: '100%', height: width * 1.1, borderRadius: 12 },
  modalTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  modalBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 10 },
  modalBtnFlag: { backgroundColor: '#EF4444' },
  modalBtnUnflag: { backgroundColor: '#374151' },
  modalBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
