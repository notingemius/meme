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
import { useTheme } from '@/ThemeProvider';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, loading, refresh } = useProfile();
  const { colors } = useTheme();
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
      <View style={[styles.center, { paddingTop: insets.top + 24, backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, color: colors.textSecondary }}>Завантаження профілю...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24, backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary, fontSize: 16, textAlign: 'center', padding: 32 }}>
          Не вдалось завантажити профіль. Перевір з'єднання з сервером.
        </Text>
        <TouchableOpacity onPress={() => refresh()} style={[styles.btnSecondary, { backgroundColor: colors.btnSecondaryBg }]}>
          <Text style={[styles.btnSecondaryText, { color: colors.primaryText }]}>Спробувати ще</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={[styles.btnSecondary, { marginTop: 12, backgroundColor: colors.btnSecondaryBg }]}>
          <Text style={[styles.btnSecondaryText, { color: colors.primaryText }]}>{'<-'} Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primaryText, fontSize: 14, fontWeight: '600' }}>{'<-'} Назад</Text>
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
                style={[styles.nickInput, { borderColor: colors.primary, color: colors.text }]}
              />
              <TouchableOpacity onPress={handleSaveNick} disabled={saving} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                <Text style={styles.saveBtnText}>{saving ? '...' : 'OK'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingNick(true)} style={styles.nickRow}>
              <Text style={[styles.nickname, { color: colors.text }]}>{profile.nickname}</Text>
              <Text style={styles.editIcon}>{'  \u270F\uFE0F'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>СТАТИСТИКА</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{profile.stats.gamesPlayed}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Iгор зіграно</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{profile.stats.gamesWon}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Перемог</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{winRate}%</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Вінрейт</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{profile.stats.roundsPlayed}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Раундів</Text>
          </View>
        </View>

        {/* Info */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>INFO</Text>
        <View style={[styles.infoCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>ID</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{profile.id.slice(0, 8)}...</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Створено</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{new Date(profile.createdAt).toLocaleDateString()}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Остання гра</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{new Date(profile.lastSeen).toLocaleDateString()}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerBlock: { alignItems: 'center', marginTop: 24, marginBottom: 32 },
  nickname: { fontSize: 24, fontWeight: '700', marginTop: 12 },
  editIcon: { fontSize: 16 },
  nickRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  editRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  nickInput: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16,
    width: 180, textAlign: 'center',
  },
  saveBtn: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },

  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 12, marginTop: 8 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flex: 1, minWidth: '45%', borderRadius: 12,
    borderWidth: 1, padding: 16, alignItems: 'center',
  },
  statValue: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 4 },

  infoCard: {
    borderRadius: 12, borderWidth: 1, padding: 16,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '500' },

  btnSecondary: { borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  btnSecondaryText: { fontSize: 15, fontWeight: '600' },
});
