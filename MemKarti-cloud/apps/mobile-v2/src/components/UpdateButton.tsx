// OTA update button. On mount it asks GitHub whether a newer APK exists than
// the running build. If so, a green "update available" button appears; tapping
// it downloads the APK (with a progress bar) and opens the Android installer.
// Shows nothing when the app is already up to date (no clutter).
import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { checkForUpdate, downloadAndInstall, type UpdateInfo } from '@/game/updater';

export function UpdateButton() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let alive = true;
    checkForUpdate()
      .then((res) => {
        if (alive) setInfo(res);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const onPress = useCallback(async () => {
    if (!info?.apkUrl || busy) return;
    setBusy(true);
    setProgress(0);
    try {
      await downloadAndInstall(info.apkUrl, (f) => setProgress(f));
      // After the installer opens, the user confirms the system dialog.
    } catch (e: any) {
      Alert.alert('Помилка оновлення', e?.message ?? 'Спробуй ще раз пізніше');
    } finally {
      setBusy(false);
    }
  }, [info, busy]);

  // Hide entirely when up to date / unknown.
  if (!info?.available || !info.apkUrl) return null;

  const pct = Math.round(progress * 100);
  const sizeLabel = info.sizeMb ? ` · ${info.sizeMb} МБ` : '';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={busy}
      style={[styles.btn, busy && styles.btnBusy]}
    >
      {busy ? (
        <>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.txt}>Завантаження… {pct}%</Text>
        </>
      ) : (
        <Text style={styles.txt}>🔄 Доступне оновлення — оновити{sizeLabel}</Text>
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
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  btnBusy: { backgroundColor: '#059669' },
  txt: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
