import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing } from '../theme/theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'WifiSetup'>;

// Простий валідатор IPv4 (192.168.x.x і т.п.).
function isValidIp(s: string): boolean {
  const m = s.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return m.slice(1).every((n) => Number(n) >= 0 && Number(n) <= 255);
}

export default function WifiSetupScreen({ route, navigation }: Props) {
  const { nickname } = route.params;
  const [hostIp, setHostIp] = useState('');

  const startHost = () => {
    navigation.navigate('Play', { nickname, role: { mode: 'wifi-host' } });
  };

  const joinHost = () => {
    const ip = hostIp.trim();
    if (!isValidIp(ip)) return;
    navigation.navigate('Play', { nickname, role: { mode: 'wifi-join', host: ip } });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.back}>← Назад</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Гра з другом по Wi-Fi</Text>
          <Text style={styles.subtitle}>
            Обидва телефони мають бути в одній Wi-Fi-мережі (або роздай інтернет з телефона-хоста).
          </Text>

          {/* СТВОРИТИ ГРУ (хост) */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📡 Створити гру</Text>
            <Text style={styles.cardDesc}>
              Ти стаєш хостом. У лобі зʼявиться твій IP — продиктуй його другу.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={startHost} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Створити гру</Text>
            </TouchableOpacity>
          </View>

          {/* ПРИЄДНАТИСЬ */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔗 Приєднатися</Text>
            <Text style={styles.cardDesc}>Введи IP-адресу хоста (напр. 192.168.0.5):</Text>
            <TextInput
              style={styles.input}
              placeholder="192.168.0.5"
              placeholderTextColor={colors.textFaint}
              value={hostIp}
              onChangeText={setHostIp}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.joinBtn, !isValidIp(hostIp) && styles.joinBtnDisabled]}
              onPress={joinHost}
              disabled={!isValidIp(hostIp)}
              activeOpacity={0.85}
            >
              <Text style={styles.joinBtnText}>Приєднатися</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  back: { color: colors.textDim, fontSize: 15, marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: spacing.sm },
  subtitle: { color: colors.textDim, fontSize: 14, lineHeight: 20, marginBottom: spacing.xl },
  card: {
    backgroundColor: colors.bgAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.xs },
  cardDesc: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  joinBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  joinBtnDisabled: { backgroundColor: colors.cardBorder },
  joinBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
