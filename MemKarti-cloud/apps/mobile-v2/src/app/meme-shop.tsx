// ============================================================================
// Meme Shop — browse memes from external sources, pick favorites, add to game.
// ----------------------------------------------------------------------------
// Shows memes available from imgflip (and other sources in the future) that are
// NOT yet in the game deck. User taps to select favorites, then presses a
// button to add them all to the live deck at once (via server API).
// ============================================================================
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { SERVER_URL } from '@/config';

const { width } = Dimensions.get('window');
const COLS = 2;
const GAP = 10;
const PAD = 16;
const CARD_W = (width - PAD * 2 - GAP * (COLS - 1)) / COLS;

type ShopMeme = {
  id: string | number;
  title: string;
  image_url: string;
  source: string;
};

export default function MemeShopScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [memes, setMemes] = useState<ShopMeme[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  // Load available memes from server (Reddit + imgflip + curated).
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${SERVER_URL}/api/meme-shop`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        setMemes(data.available ?? []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSelect = useCallback((meme: ShopMeme) => {
    const key = meme.image_url;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const addSelected = useCallback(async () => {
    const toAdd = memes.filter((m) => selected.has(m.image_url));
    if (toAdd.length === 0) {
      Alert.alert('Нічого не вибрано', 'Тапни на меми які хочеш додати в гру');
      return;
    }

    setAdding(true);
    try {
      const body = {
        memes: toAdd.map((m) => ({
          title: m.title,
          image_url: m.image_url,
          category: 'general',
        })),
      };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${SERVER_URL}/api/deck/memes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        setAddedCount((c) => c + toAdd.length);
        // Remove added from list + reload fresh batch
        setMemes((prev) => prev.filter((m) => !selected.has(m.image_url)));
        setSelected(new Set());
        Alert.alert(
          '✅ Додано!',
          `${toAdd.length} мемів додано в гру.\nЗагалом в колоді: ${data.totalMemes}.\nНатисни «🔄 Ще» для свіжої порції!`,
        );
      } else {
        Alert.alert('Помилка', 'Не вдалось додати меми');
      }
    } catch {
      Alert.alert('Помилка', 'Сервер недоступний');
    }
    setAdding(false);
  }, [memes, selected]);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹ Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🛒 Магазин мемів</Text>
        <TouchableOpacity onPress={load} disabled={loading} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[styles.refresh, loading && { opacity: 0.4 }]}>🔄 Ще</Text>
        </TouchableOpacity>
      </View>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Text style={styles.counter}>
          Доступно: <Text style={{ fontWeight: '700', color: '#10B981' }}>{memes.length}</Text>
          {selected.size > 0 && (
            <Text style={{ color: '#2563EB' }}>{'  '}Вибрано: {selected.size}</Text>
          )}
        </Text>
        {addedCount > 0 && (
          <Text style={styles.addedBadge}>+{addedCount} ✓</Text>
        )}
      </View>

      <Text style={styles.hint}>Тапни мем щоб вибрати. «🔄 Ще» — свіжа порція.</Text>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={{ color: '#6B7280', marginTop: 12 }}>Завантажую меми з інтернету…</Text>
        </View>
      ) : memes.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Text style={{ fontSize: 48 }}>🎉</Text>
          <Text style={{ color: '#6B7280', marginTop: 12, textAlign: 'center', fontSize: 15 }}>
            Всі доступні меми вже в грі! Чекай на нові джерела.
          </Text>
        </View>
      ) : (
        <FlatList
          data={memes}
          keyExtractor={(m) => m.image_url}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: PAD }}
          contentContainerStyle={{ gap: GAP, paddingVertical: 12, paddingBottom: insets.bottom + 100 }}
          initialNumToRender={10}
          windowSize={7}
          removeClippedSubviews
          renderItem={({ item }) => {
            const isSelected = selected.has(item.image_url);
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => toggleSelect(item)}
                style={[styles.card, { width: CARD_W }, isSelected && styles.cardSelected]}
              >
                <Image source={{ uri: item.image_url }} style={styles.img} resizeMode="cover" />
                <View style={styles.cardFooter}>
                  <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.source}>{item.source}</Text>
                </View>
                <View style={[styles.badge, isSelected ? styles.badgeOn : styles.badgeOff]}>
                  <Text style={styles.badgeText}>{isSelected ? '✓' : '+'}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Floating action button */}
      {selected.size > 0 && (
        <View style={[styles.fab, { bottom: insets.bottom + 16 }]}>  
          <TouchableOpacity
            onPress={addSelected}
            disabled={adding}
            style={[styles.fabBtn, adding && { opacity: 0.7 }]}
          >
            {adding ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.fabText}>
                🎮 Додати {selected.size} мемів в гру
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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
  refresh: { fontSize: 14, color: '#10B981', fontWeight: '700', width: 60, textAlign: 'right' },
  title: { fontSize: 16, color: '#111827', fontWeight: '700' },

  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: PAD, paddingTop: 12,
  },
  counter: { fontSize: 14, color: '#374151' },
  addedBadge: { fontSize: 13, color: '#10B981', fontWeight: '600' },

  hint: { fontSize: 12, color: '#9CA3AF', paddingHorizontal: PAD, paddingTop: 6 },

  card: {
    borderRadius: 12, overflow: 'hidden', backgroundColor: '#F9FAFB',
    borderWidth: 2, borderColor: 'transparent',
  },
  cardSelected: { borderColor: '#10B981' },
  img: { width: '100%', height: CARD_W * 0.78, backgroundColor: '#E5E7EB' },
  cardFooter: { paddingHorizontal: 8, paddingVertical: 8 },
  cardTitle: { fontSize: 11, color: '#374151', fontWeight: '500' },
  source: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  badge: {
    position: 'absolute', top: 6, right: 6, width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeOn: { backgroundColor: '#10B981' },
  badgeOff: { backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: '#E5E7EB' },
  badgeText: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },

  fab: {
    position: 'absolute', left: PAD, right: PAD,
  },
  fabBtn: {
    backgroundColor: '#10B981', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
    elevation: 8,
  },
  fabText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
