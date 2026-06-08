// ============================================================================
// Friends leaderboard screen - shows people you have played with, ranked by wins.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SERVER_URL } from '@/config';
import { getCachedProfile } from '@/game/profile';
import { Avatar } from '@/components/Avatar';

type LeaderboardEntry = {
  profileId: string;
  nickname: string;
  avatarSeed: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesTogether: number;
  lastPlayed: string;
};

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const profile = await getCachedProfile();
      if (!profile) {
        setLoading(false);
        return;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${SERVER_URL}/api/leaderboard/${profile.id}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.leaderboard ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB', paddingTop: insets.top + 16 }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>{'\u2190'} Назад</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Таблиця друзiв</Text>
        <Text style={styles.subtitle}>Люди, з якими ти грав, ранжованi за перемогами</Text>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        )}

        {!loading && entries.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🎮</Text>
            <Text style={styles.emptyTitle}>Поки порожньо</Text>
            <Text style={styles.emptyText}>
              Зiграй з друзями онлайн, i вони зʼявляться тут!
            </Text>
          </View>
        )}

        {!loading &&
          entries.map((entry, index) => (
            <View key={entry.profileId} style={styles.row}>
              <Text style={styles.rank}>#{index + 1}</Text>
              <Avatar id={entry.avatarSeed} nickname={entry.nickname} size={40} />
              <View style={styles.info}>
                <Text style={styles.nickname}>{entry.nickname}</Text>
                <Text style={styles.stats}>
                  {entry.gamesWon} перемог / {entry.gamesPlayed} iгор
                </Text>
                <Text style={styles.together}>
                  Разом: {entry.gamesTogether} {entry.gamesTogether === 1 ? 'гра' : entry.gamesTogether < 5 ? 'гри' : 'iгор'}
                </Text>
              </View>
              {index === 0 && entries.length > 0 && (
                <Text style={styles.crown}>👑</Text>
              )}
            </View>
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: { color: '#2563EB', fontSize: 14, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', color: '#111827', marginTop: 12 },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4, marginBottom: 24 },
  center: { marginTop: 40, alignItems: 'center' },
  emptyBox: { marginTop: 60, alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  rank: { fontSize: 14, fontWeight: '700', color: '#6B7280', marginRight: 12, width: 28 },
  info: { flex: 1, marginLeft: 12 },
  nickname: { fontSize: 15, fontWeight: '600', color: '#111827' },
  stats: { fontSize: 12, color: '#2563EB', marginTop: 2 },
  together: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  crown: { fontSize: 20 },
});
