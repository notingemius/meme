// Persisted user settings via AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@memkarti_settings';

export type AppSettings = {
  darkMode: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
};

let cached: AppSettings | null = null;

export async function loadSettings(): Promise<AppSettings> {
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) {
      cached = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      return cached!;
    }
  } catch {
    // ignore parse errors
  }
  cached = { ...DEFAULT_SETTINGS };
  return cached;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  cached = settings;
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // best effort
  }
}

export async function updateSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<AppSettings> {
  const current = await loadSettings();
  const next = { ...current, [key]: value };
  await saveSettings(next);
  return next;
}
