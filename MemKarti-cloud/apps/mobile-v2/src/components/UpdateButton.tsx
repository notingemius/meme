// Shows a green "update available" pill on the home screen ONLY when the
// latest GitHub release has a different commit than this build. Tapping it
// opens the APK download link in the browser. Fully JS — no native modules,
// no extra permissions, works in any release APK.
import { useEffect, useState, useCallback } from 'react';
import { Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { checkForUpdate, openDownload, type UpdateInfo } from '@/game/updater';

export function UpdateButton() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);

  const run = useCallback(async () => {
    const r = await checkForUpdate();
    setInfo(r);
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  // Silent unless a newer version actually exists.
  if (!info || !info.available) return null;

  return (
    <TouchableOpacity
      style={styles.btn}
      activeOpacity={0.85}
      onPress={() =>
        Alert.alert(
          'Доступне оновлення 🎉',
          'Завантажити нову версію застосунку? Після завантаження тапни файл, щоб встановити (як при першій установці).',
          [
            { text: 'Пізніше', style: 'cancel' },
            { text: 'Завантажити', onPress: () => openDownload(info.apkUrl) },
          ],
        )
      }
    >
      <Text style={styles.txt}>🔄 Доступне оновлення — завантажити</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#10B981',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  txt: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
