// Self-hosted OTA update button (expo-updates -> our Bunny server).
// JS-only updates arrive over the air, no full APK reinstall:
//  - On launch the app checks our server and downloads a new bundle in the
//    background. When one is ready, a green "restart to update" button shows.
//  - The user can also tap "check for updates" to pull + apply instantly.
// Shows nothing in dev builds (OTA is release-only).
import { useEffect, useState, useCallback } from 'react';
import { Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import * as Updates from 'expo-updates';
import { checkAndFetch, applyUpdate, checkFetchApply, otaEnabled } from '@/game/ota';

export function UpdateButton() {
  // `useUpdates` reflects expo-updates' own background ON_LOAD checks.
  const { isUpdatePending } = Updates.useUpdates();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Also kick an explicit check on mount so the "restart" button can appear
  // within this session (not only after expo-updates' own cycle).
  useEffect(() => {
    let alive = true;
    checkAndFetch().then((r) => {
      if (alive && r === 'updated') setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const showRestart = ready || isUpdatePending;

  const onApply = useCallback(() => {
    applyUpdate();
  }, []);

  const onManualCheck = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    setStatus(null);
    const r = await checkFetchApply(); // reloads itself if an update was found
    if (r === 'none') setStatus('✓ У тебе остання версія');
    else if (r === 'error') setStatus('Не вдалось перевірити');
    setChecking(false);
  }, [checking]);

  if (showRestart) {
    return (
      <TouchableOpacity onPress={onApply} activeOpacity={0.85} style={[styles.btn, styles.btnReady]}>
        <Text style={styles.txt}>🔄 Оновлення готове — перезапустити</Text>
      </TouchableOpacity>
    );
  }

  // In dev builds OTA is disabled — render nothing to avoid confusion.
  if (!otaEnabled) return null;

  return (
    <TouchableOpacity
      onPress={onManualCheck}
      activeOpacity={0.85}
      disabled={checking}
      style={[styles.btn, styles.btnCheck]}
    >
      {checking ? (
        <ActivityIndicator size="small" color="#2563EB" />
      ) : (
        <Text style={styles.txtCheck}>{status ?? '🔄 Перевірити оновлення'}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  btnReady: { backgroundColor: '#10B981' },
  btnCheck: { backgroundColor: '#EEF2FF' },
  txt: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  txtCheck: { color: '#2563EB', fontSize: 14, fontWeight: '600' },
});
