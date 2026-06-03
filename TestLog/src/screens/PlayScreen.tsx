import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing } from '../theme/theme';
import type { RootStackParamList } from '../navigation';
import { useMatch, type MatchRole } from '../game/useMatch';
import LobbyView from './LobbyView';
import GameView from './GameView';
import ResultsView from './ResultsView';

type Props = NativeStackScreenProps<RootStackParamList, 'Play'>;

const CONN_LABEL: Record<string, string> = {
  idle: '',
  connecting: 'Підключення…',
  connected: 'Підключено',
  reconnecting: 'Зʼєднання втрачено, перепідключення…',
  disconnected: 'Відключено',
};

// Единый экран матча: держит ОДИН инстанс игры на всё время партии и
// переключает под-вид по фазе. Поддерживает игру с ботами и по Wi-Fi.
export default function PlayScreen({ route, navigation }: Props) {
  const { nickname, role: roleParam } = route.params;
  const role: MatchRole = roleParam ?? { mode: 'bots' };
  const { view, error, send, ready, conn, hostIp, isHost, fatal } = useMatch(nickname, role);

  const isBots = role.mode === 'bots';
  const isWifiHost = role.mode === 'wifi-host';
  const isWifiJoin = role.mode === 'wifi-join';

  // Авто-добор ботов — ТОЛЬКО для игры с ботами (для Wi-Fi ждём живых игроков).
  useEffect(() => {
    if (isBots && ready && view && view.phase === 'lobby' && view.players.length === 1) {
      send({ type: 'addBot' });
      send({ type: 'addBot' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBots, ready, view?.phase, view?.players.length]);

  const goMenu = () => navigation.navigate('Menu');

  // Фатальна помилка налаштування (немає TCP-модуля / не вдалось підключитись).
  if (fatal) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.fatalTitle}>Не вдалося почати гру по Wi-Fi</Text>
        <Text style={styles.fatalMsg}>{fatal}</Text>
        <TouchableOpacity style={styles.menuBtn} onPress={goMenu} activeOpacity={0.85}>
          <Text style={styles.menuBtnText}>← У меню</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!view) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>
          {isWifiJoin ? 'Підключення до хоста…' : isWifiHost ? 'Створення гри…' : 'Підготовка гри…'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Банер Wi-Fi: IP хоста або статус зʼєднання гостя (лише в лобі/підключенні). */}
      {isWifiHost && view.phase === 'lobby' && (
        <View style={styles.banner}>
          <Text style={styles.bannerLabel}>Скажи другу ввести цей IP:</Text>
          <Text style={styles.bannerIp}>{hostIp ?? 'визначаю IP…'}</Text>
          <Text style={styles.bannerHint}>Ви маєте бути в одній Wi-Fi-мережі</Text>
        </View>
      )}
      {isWifiJoin && conn !== 'connected' && (
        <View style={styles.banner}>
          <Text style={styles.bannerLabel}>{CONN_LABEL[conn] || 'Підключення…'}</Text>
        </View>
      )}

      {view.phase === 'lobby' && <LobbyView view={view} error={error} send={send} />}
      {(view.phase === 'playing' || view.phase === 'judging') && (
        <GameView view={view} error={error} send={send} />
      )}
      {(view.phase === 'results' || view.phase === 'finished') && (
        <ResultsView view={view} send={send} onExit={goMenu} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingText: { color: colors.textDim, marginTop: spacing.md, fontSize: 15 },
  banner: {
    backgroundColor: colors.bgAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  bannerLabel: { color: colors.textDim, fontSize: 13 },
  bannerIp: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
    marginVertical: 2,
  },
  bannerHint: { color: colors.textFaint, fontSize: 11 },
  fatalTitle: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: spacing.md },
  fatalMsg: { color: colors.textDim, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl },
  menuBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
  },
  menuBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
