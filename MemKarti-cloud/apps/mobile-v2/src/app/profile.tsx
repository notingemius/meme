// ============================================================================
// Profile screen - shows player stats, allows editing nickname.
// ============================================================================

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { useProfile, updateProfileNickname } from '@/game/profile';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, loading, refresh } = useProfile();
  const [editingNick, setEditingNick] = useState(false);
  const [newNick, setNewNick] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setNewNick(profile.nickname);
  }, [profile]);

  const handleSaveNick = async () => {
    if (!profile || !newNick.trim()) return;
    if (newNick.trim() === profile.nickname) {
      setEditingNick(false);
      return;
    }
    setSaving(true);
    const updated = await updateProfileNickname(profile.id, newNick.trim());
    if (updated) {
      await refresh();
      setEditingNick(false);
    } else {
      Alert.alert('Помилка', 'Не вдалось зберегти нік. Перевір зв\'язок.');
    }
    setSaving(false);
  };

  const winRate = profile && profile.stats.gamesPlayed > 0
    ? Math.round((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100)
    : 0;

  if (loading && !profile) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24 }]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ marginTop: 16, color: '#6B7280' }}>Завантаження профілю...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24 }]}>
        <Text style={{ color: '#6B7280', fontSize: 16, textAlign: 'center', padding: 32 }}>
          Не вдалось завантажити профіль. Перевір з'єднання з сервером.
        </Text>
        <TouchableOpacity onPress={() => refresh()} style={styles.btnSecondary}>
          <Text style={styles.btnSecondaryText}>Спробувати ще</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={[styles.btnSecondary, { marginTop: 12 }]}>
          <Text style={styles.btnSecondaryText}>{'<-'} Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#2563EB', fontSize: 14, fontWeight: '600' }}>{'<-'} Назад</Text>
        </TouchableOpacity>

        {/* Avatar + Nickname */}
        <View style={styles.headerBlock}>
          <Avatar id={profile.avatarSeed} nickname={profile.nickname} size={72} />
          {editingNick ? (
            <View style={styles.editRow}>
              <TextInput
                value={newNick}
                onChangeText={setNewNick}
                maxLength={20}
                autoFocus
                style={styles.nickInput}
              />
              <TouchableOpacity onPress={handleSaveNick} disabled={saving} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>{saving ? '...' : 'OK'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingNick(true)} style={styles.nickRow}>
              <Text style={styles.nickname}>{profile.nickname}</Text>
              <Text style={styles.editIcon}>{'  \u270F\uFE0F'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <Text style={styles.sectionLabel}>СТАТИСТИКА</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile.stats.gamesPlayed}</Text>
            <Text style={styles.statLabel}>Iгор зіграно</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile.stats.gamesWon}</Text>
            <Text style={styles.statLabel}>Перемог</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{winRate}%</Text>
            <Text style={styles.statLabel}>Вінрейт</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile.stats.roundsPlayed}</Text>
            <Text style={styles.statLabel}>Раундів</Text>
          </View>
        </View>

        {/* Info */}
        <Text style={styles.sectionLabel}>INFO</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ID</Text>
            <Text style={styles.infoValue}>{profile.id.slice(0, 8)}...</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Створено</Text>
            <Text style={styles.infoValue}>{new Date(profile.createdAt).toLocaleDateString()}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Остання гра</Text>
            <Text style={styles.infoValue}>{new Date(profile.lastSeen).toLocaleDateString()}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },

  headerBlock: { alignItems: 'center', marginTop: 24, marginBottom: 32 },
  nickname: { fontSize: 24, fontWeight: '700', color: '#111827', marginTop: 12 },
  editIcon: { fontSize: 16 },
  nickRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  editRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  nickInput: {
    borderWidth: 1, borderColor: '#2563EB', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: '#111827',
    width: 180, textAlign: 'center',
  },
  saveBtn: { backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },

  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280', letterSpacing: 1, marginBottom: 12, marginTop: 8 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', padding: 16, alignItems: 'center',
  },
  statValue: { fontSize: 28, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },

  infoCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1,
    borderColor: '#E5E7EB', padding: 16,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  infoLabel: { fontSize: 13, color: '#6B7280' },
  infoValue: { fontSize: 13, color: '#111827', fontWeight: '500' },

  btnSecondary: { backgroundColor: '#EFF6FF', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  btnSecondaryText: { fontSize: 15, color: '#2563EB', fontWeight: '600' },
});
