import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing } from '../theme/theme';
import type { RootStackParamList } from '../navigation';
import { useOfflineGame } from '../game/useOfflineGame';
import LobbyView from './LobbyView';
import GameView from './GameView';
import ResultsView from './ResultsView';

type Props = NativeStackScreenProps<RootStackParamList, 'Play'>;

// Единый экран матча: держит ОДИН инстанс игры на всё время партии и
// переключает под-вид по фазе. Это исключает пересоздание хоста при
// переходах и связанные с этим баги.
export default function PlayScreen({ route, navigation }: Props) {
  const { nickname } = route.params;
  const { view, error, send, ready } = useOfflineGame(nickname);

  // Авто-добор ботов до минимума для одиночной игры — для удобства старта.
  useEffect(() => {
    if (ready && view && view.phase === 'lobby' && view.players.length === 1) {
      send({ type: 'addBot' });
      send({ type: 'addBot' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, view?.phase, view?.players.length]);

  const goMenu = () => navigation.navigate('Menu');

  if (!view) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Підготовка гри…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
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
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.textDim, marginTop: spacing.md, fontSize: 15 },
});
