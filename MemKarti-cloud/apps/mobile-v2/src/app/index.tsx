import { useState } from 'react';
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

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');

  const handleCreateRoom = () => {
    if (!nickname.trim()) {
      Alert.alert('Введи нік', 'Спочатку введи своє імʼя');
      return;
    }
    // Онлайн-кімната через інтернет (сервер на Render). Хост створює кімнату,
    // отримує код і ділиться ним з друзями.
    router.push({ pathname: '/online', params: { nickname: nickname.trim(), action: 'create' } });
  };

  const handleJoinRoom = () => {
    if (!nickname.trim() || !roomCode.trim()) {
      Alert.alert('Заповни поля', 'Введи нік і код кімнати');
      return;
    }
    router.push({
      pathname: '/online',
      params: { nickname: nickname.trim(), action: 'join', code: roomCode.trim().toUpperCase() },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar style="dark" />
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
            <Text style={styles.heroTitle}>МемКарти 🃏</Text>
            <Text style={styles.heroSubtitle}>
              Картки з ситуаціями та найсмішніші меми. Збирай друзів і дізнайся,
              у кого найкраще почуття гумору.
            </Text>
          </View>

          <ServerStatus />

          <UpdateButton />

          <View style={styles.cardsRow}>
            <View style={styles.featureCard}>
              <Text style={styles.featureTitle}>3–10 гравців</Text>
              <Text style={styles.featureSubtitle}>Грай із компанією</Text>
            </View>
            <View style={styles.featureCard}>
              <Text style={styles.featureTitle}>2 режими</Text>
              <Text style={styles.featureSubtitle}>Суддя або голосування</Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {mode === 'menu' ? 'Почати гру' : 'Приєднатись до кімнати'}
            </Text>
            <Text style={styles.formSubtitle}>
              {mode === 'menu'
                ? 'Створи нову кімнату або приєднайся за кодом'
                : 'Введи код від друга, щоб приєднатись'}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.inputLabel}>ТВІЙ НІК</Text>
              <TouchableOpacity
                onPress={() => setNickname(randomNick())}
                style={styles.diceBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.diceBtnText}>🎲 Випадковий</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="Наприклад: Олег"
              placeholderTextColor="#9CA3AF"
              maxLength={20}
              style={styles.input}
            />

            {mode === 'join' && (
              <>
                <Text style={[styles.inputLabel, { marginTop: 16 }]}>КОД КІМНАТИ</Text>
                <TextInput
                  value={roomCode}
                  onChangeText={(t) => setRoomCode(t.toUpperCase())}
                  placeholder="ABC123"
                  placeholderTextColor="#9CA3AF"
                  maxLength={6}
                  autoCapitalize="characters"
                  style={[styles.input, { letterSpacing: 4, fontSize: 18, fontWeight: '600' }]}
                />
              </>
            )}

            {mode === 'menu' ? (
              <View style={{ marginTop: 20, gap: 10 }}>
                <TouchableOpacity onPress={handleCreateRoom} style={styles.btnPrimary}>
                  <Text style={styles.btnPrimaryText}>Створити кімнату</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMode('join')}
                  style={styles.btnSecondary}
                >
                  <Text style={styles.btnSecondaryText}>Приєднатись за кодом</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/wifi')}
                  style={styles.btnTertiary}
                >
                  <Text style={styles.btnSecondaryText}>Рядом по Wi-Fi (офлайн)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (!nickname.trim()) {
                      Alert.alert('Введи нік', 'Спочатку введи своє імʼя');
                      return;
                    }
                    router.push({ pathname: '/solo', params: { nickname: nickname.trim() } });
                  }}
                  style={styles.btnTertiary}
                >
                  <Text style={styles.btnSecondaryText}>Грати з ботами (соло)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/memes')}
                  style={styles.btnReview}
                >
                  <Text style={styles.btnReviewText}>🚩 Переглянути всі меми (QA)</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginTop: 20, gap: 10 }}>
                <TouchableOpacity onPress={handleJoinRoom} style={styles.btnPrimary}>
                  <Text style={styles.btnPrimaryText}>Увійти в гру</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setMode('menu');
                    setRoomCode('');
                  }}
                  style={{ paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#6B7280', fontSize: 14 }}>← Назад</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={{ marginTop: 32 }}>
            <Text style={styles.howLabel}>ЯК ГРАТИ</Text>
            {[
              'Створи кімнату або приєднайся за кодом',
              'Дочекайся друзів у лоббі',
              'Прочитай ситуацію та обери смішний мем',
              'Суддя або всі разом обирають переможця',
              'Перший до 5 очок виграє',
            ].map((line, i) => (
              <View key={i} style={{ flexDirection: 'row', paddingVertical: 4 }}>
                <Text style={{ color: '#9CA3AF', marginRight: 10 }}>-</Text>
                <Text style={{ color: '#4B5563', fontSize: 14, flex: 1 }}>{line}</Text>
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
  heroTitle: { fontSize: 32, color: '#111827', letterSpacing: -0.5, lineHeight: 38, fontWeight: '600' },
  heroSubtitle: { fontSize: 15, color: '#6B7280', marginTop: 8, lineHeight: 22 },

  cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  featureCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', padding: 16,
  },
  featureTitle: { fontSize: 14, color: '#111827', marginTop: 12, fontWeight: '600' },
  featureSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },

  formCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1,
    borderColor: '#E5E7EB', padding: 20,
  },
  formTitle: { fontSize: 16, color: '#111827', fontWeight: '600' },
  formSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 4 },

  inputLabel: { fontSize: 12, color: '#6B7280', marginBottom: 6, marginTop: 20, fontWeight: '500' },
  diceBtn: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginTop: 14 },
  diceBtnText: { fontSize: 12, color: '#2563EB', fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', backgroundColor: '#FFFFFF',
  },

  btnPrimary: {
    backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  btnPrimaryText: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  btnSecondary: {
    backgroundColor: '#EFF6FF', borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  btnSecondaryText: { fontSize: 15, color: '#2563EB', fontWeight: '600' },
  btnTertiary: {
    backgroundColor: '#EEF2FF', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  btnReview: {
    backgroundColor: '#FEF2F2', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
    borderWidth: 1, borderColor: '#FCA5A5',
  },
  btnReviewText: { fontSize: 15, color: '#B91C1C', fontWeight: '600' },

  howLabel: { fontSize: 12, color: '#6B7280', marginBottom: 12, letterSpacing: 0.5, fontWeight: '500' },
});
