import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { randomNick } from '@/game/nickGen';
import { ServerStatus } from '@/components/ServerStatus';
import { UpdateButton } from '@/components/UpdateButton';
import { useProfile, syncProfile } from '@/game/profile';
import { Avatar } from '@/components/Avatar';
import { useTheme } from '@/ThemeProvider';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');
  const { profile } = useProfile();
  const { colors, isDark, toggle } = useTheme();

  // Pre-fill nickname from saved profile
  useEffect(() => {
    if (profile && !nickname) {
      setNickname(profile.nickname);
    }
  }, [profile]);

  const handleCreateRoom = () => {
    if (!nickname.trim()) {
      Alert.alert('Введи нік', 'Спочатку введи своє імʼя');
      return;
    }
    // Sync nickname to profile before creating room
    syncProfile(nickname.trim());
    router.push({ pathname: '/online', params: { nickname: nickname.trim(), action: 'create' } });
  };

  const handleJoinRoom = () => {
    if (!nickname.trim() || !roomCode.trim()) {
      Alert.alert('Заповни поля', 'Введи нік і код кімнати');
      return;
    }
    syncProfile(nickname.trim());
    router.push({
      pathname: '/online',
      params: { nickname: nickname.trim(), action: 'join', code: roomCode.trim().toUpperCase() },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 20,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroBlock}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.heroTitle, { color: colors.text }]}>МемКарти 🃏 ✨</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity onPress={toggle} style={[styles.themeToggle, { backgroundColor: colors.btnTertiaryBg }]}>
                  <Text style={{ fontSize: 18 }}>{isDark ? '☀️' : '🌙'}</Text>
                </TouchableOpacity>
                {profile && (
                  <TouchableOpacity onPress={() => router.push('/profile')} style={styles.profileBtn}>
                    <Avatar id={profile.avatarSeed} nickname={profile.nickname} size={36} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              Картки з ситуаціями та найсмішніші меми. Збирай друзів і дізнайся,
              у кого найкраще почуття гумору.
            </Text>
            {profile && profile.stats.gamesPlayed > 0 && (
              <TouchableOpacity onPress={() => router.push('/profile')} style={styles.miniStats}>
                <Text style={[styles.miniStatsText, { color: colors.textSecondary }]}>
                  {profile.stats.gamesPlayed} ігор | {profile.stats.gamesWon} перемог
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <ServerStatus />

          <UpdateButton />

          <View style={styles.cardsRow}>
            <View style={[styles.featureCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Text style={[styles.featureTitle, { color: colors.text }]}>3–10 гравців</Text>
              <Text style={[styles.featureSubtitle, { color: colors.textSecondary }]}>Грай із компанією</Text>
            </View>
            <View style={[styles.featureCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Text style={[styles.featureTitle, { color: colors.text }]}>2 режими</Text>
              <Text style={[styles.featureSubtitle, { color: colors.textSecondary }]}>Суддя або голосування</Text>
            </View>
          </View>

          <View style={[styles.formCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.text }]}>
              {mode === 'menu' ? '🎮 Нова гра' : 'Приєднатись до кімнати'}
            </Text>
            <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>
              {mode === 'menu'
                ? 'Створи нову кімнату або приєднайся за кодом'
                : 'Введи код від друга, щоб приєднатись'}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>ТВІЙ НІК</Text>
              <TouchableOpacity
                onPress={() => setNickname(randomNick())}
                style={[styles.diceBtn, { backgroundColor: colors.btnTertiaryBg }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.diceBtnText, { color: colors.primaryText }]}>🎲 Випадковий</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="Наприклад: Олег"
              placeholderTextColor={colors.textMuted}
              maxLength={20}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
            />

            {mode === 'join' && (
              <>
                <Text style={[styles.inputLabel, { marginTop: 16, color: colors.textSecondary }]}>КОД КІМНАТИ</Text>
                <TextInput
                  value={roomCode}
                  onChangeText={(t) => setRoomCode(t.toUpperCase())}
                  placeholder="ABC123"
                  placeholderTextColor={colors.textMuted}
                  maxLength={6}
                  autoCapitalize="characters"
                  style={[styles.input, { letterSpacing: 4, fontSize: 18, fontWeight: '600', borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
                />
              </>
            )}

            {mode === 'menu' ? (
              <View style={{ marginTop: 20, gap: 10 }}>
                <TouchableOpacity onPress={handleCreateRoom} style={[styles.btnPrimary, { backgroundColor: colors.primary }]}>
                  <Text style={styles.btnPrimaryText}>Створити кімнату</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMode('join')}
                  style={[styles.btnSecondary, { backgroundColor: colors.btnSecondaryBg }]}
                >
                  <Text style={[styles.btnSecondaryText, { color: colors.primaryText }]}>Приєднатись за кодом</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/wifi')}
                  style={[styles.btnTertiary, { backgroundColor: colors.btnTertiaryBg }]}
                >
                  <Text style={[styles.btnSecondaryText, { color: colors.primaryText }]}>Рядом по Wi-Fi (офлайн)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (!nickname.trim()) {
                      Alert.alert('Введи нік', 'Спочатку введи своє імʼя');
                      return;
                    }
                    syncProfile(nickname.trim());
                    router.push({ pathname: '/solo', params: { nickname: nickname.trim() } });
                  }}
                  style={[styles.btnTertiary, { backgroundColor: colors.btnTertiaryBg }]}
                >
                  <Text style={[styles.btnSecondaryText, { color: colors.primaryText }]}>Грати з ботами (соло)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/memes')}
                  style={[styles.btnReview, { backgroundColor: colors.errorBg, borderColor: isDark ? '#FCA5A5' : '#FCA5A5' }]}
                >
                  <Text style={[styles.btnReviewText, { color: colors.error }]}>🚩 Переглянути всі меми (QA)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/profile')}
                  style={[styles.btnProfile, { backgroundColor: isDark ? '#064E3B' : '#F0FDF4', borderColor: isDark ? '#34D399' : '#86EFAC' }]}
                >
                  <Text style={[styles.btnProfileText, { color: isDark ? '#6EE7B7' : '#166534' }]}>👤 Мій профіль</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/leaderboard')}
                  style={[styles.btnLeaderboard, { backgroundColor: isDark ? '#78350F' : '#FEF9C3', borderColor: isDark ? '#FBBF24' : '#FDE047' }]}
                >
                  <Text style={[styles.btnLeaderboardText, { color: isDark ? '#FDE68A' : '#854D0E' }]}>🏆 Таблиця друзiв</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginTop: 20, gap: 10 }}>
                <TouchableOpacity onPress={handleJoinRoom} style={[styles.btnPrimary, { backgroundColor: colors.primary }]}>
                  <Text style={styles.btnPrimaryText}>Увійти в гру</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setMode('menu');
                    setRoomCode('');
                  }}
                  style={{ paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>← Назад</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={{ marginTop: 32 }}>
            <Text style={[styles.howLabel, { color: colors.textSecondary }]}>ЯК ГРАТИ</Text>
            {[
              'Створи кімнату або приєднайся за кодом',
              'Дочекайся друзів у лоббі',
              'Прочитай ситуацію та обери смішний мем',
              'Суддя або всі разом обирають переможця',
              'Перший до 5 очок виграє',
            ].map((line, i) => (
              <View key={i} style={{ flexDirection: 'row', paddingVertical: 4 }}>
                <Text style={{ color: colors.textMuted, marginRight: 10 }}>-</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 14, flex: 1 }}>{line}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  heroBlock: { marginBottom: 32 },
  heroTitle: { fontSize: 32, letterSpacing: -0.5, lineHeight: 38, fontWeight: '600' },
  heroSubtitle: { fontSize: 15, marginTop: 8, lineHeight: 22 },

  themeToggle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },

  cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  featureCard: {
    flex: 1, borderRadius: 12,
    borderWidth: 1, padding: 16,
  },
  featureTitle: { fontSize: 14, marginTop: 12, fontWeight: '600' },
  featureSubtitle: { fontSize: 12, marginTop: 4 },

  formCard: {
    borderRadius: 12, borderWidth: 1, padding: 20,
  },
  formTitle: { fontSize: 16, fontWeight: '600' },
  formSubtitle: { fontSize: 13, marginTop: 4 },

  inputLabel: { fontSize: 12, marginBottom: 6, marginTop: 20, fontWeight: '500' },
  diceBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginTop: 14 },
  diceBtnText: { fontSize: 12, fontWeight: '600' },
  input: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15,
  },

  btnPrimary: {
    borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  btnPrimaryText: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  btnSecondary: {
    borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  btnSecondaryText: { fontSize: 15, fontWeight: '600' },
  btnTertiary: {
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  btnReview: {
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
    borderWidth: 1,
  },
  btnReviewText: { fontSize: 15, fontWeight: '600' },
  btnProfile: {
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
    borderWidth: 1,
  },
  btnProfileText: { fontSize: 15, fontWeight: '600' },
  btnLeaderboard: {
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
    borderWidth: 1,
  },
  btnLeaderboardText: { fontSize: 15, fontWeight: '600' },
  profileBtn: { padding: 4 },
  miniStats: { marginTop: 8, paddingVertical: 4, paddingHorizontal: 8 },
  miniStatsText: { fontSize: 12, fontWeight: '500' },

  howLabel: { fontSize: 12, marginBottom: 12, letterSpacing: 0.5, fontWeight: '500' },
});
