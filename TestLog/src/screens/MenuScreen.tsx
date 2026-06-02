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

type Props = NativeStackScreenProps<RootStackParamList, 'Menu'>;

export default function MenuScreen({ navigation }: Props) {
  const [nickname, setNickname] = useState('');

  const startOffline = () => {
    const nick = nickname.trim() || 'Гравець';
    navigation.navigate('Play', { nickname: nick });
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoEmoji}>🎴</Text>
            </View>
          </View>
          <Text style={styles.title}>МемКарти</Text>
          <Text style={styles.subtitle}>
            Карткова гра з мемами для компанії друзів
          </Text>

          <Text style={styles.label}>Твій нік</Text>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder="Введи ім'я"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            maxLength={20}
            returnKeyType="go"
            onSubmitEditing={startOffline}
          />

          <TouchableOpacity style={styles.primaryBtn} onPress={startOffline} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>🎮 Грати з ботами</Text>
          </TouchableOpacity>

          <View style={styles.soonBtn}>
            <Text style={styles.soonBtnText}>📶 Поряд по Wi-Fi</Text>
            <Text style={styles.soonBadge}>скоро</Text>
          </View>

          <View style={styles.howto}>
            <Text style={styles.howtoTitle}>ЯК ГРАТИ</Text>
            {[
              'Суддя бачить ситуацію, інші обирають найсмішніший мем',
              'Суддя обирає переможця раунду',
              'Перший, хто набере потрібні очки — чемпіон',
            ].map((line, i) => (
              <View key={i} style={styles.howtoRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.howtoText}>{line}</Text>
              </View>
            ))}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'center' },
  logoRow: { alignItems: 'center', marginBottom: spacing.lg },
  logoBadge: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 44 },
  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 15,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  label: {
    color: colors.textDim,
    fontSize: 13,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  input: {
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  soonBtn: {
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    opacity: 0.6,
  },
  soonBtnText: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  soonBadge: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: colors.cardBorder,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  howto: {
    marginTop: spacing.xl,
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
  },
  howtoTitle: {
    color: colors.textFaint,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  howtoRow: { flexDirection: 'row', marginBottom: spacing.sm },
  bullet: { color: colors.primary, fontSize: 14, marginRight: spacing.sm },
  howtoText: { color: colors.textDim, fontSize: 14, flex: 1, lineHeight: 20 },
});
