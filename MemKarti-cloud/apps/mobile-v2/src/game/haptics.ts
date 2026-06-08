// Haptic feedback helpers using expo-haptics.
// Respects user preference from settings.
import * as Haptics from 'expo-haptics';
import { loadSettings } from './settings';

async function isEnabled(): Promise<boolean> {
  const s = await loadSettings();
  return s.hapticsEnabled;
}

/** Light tap - card selection, button press */
export async function tapHaptic(): Promise<void> {
  if (!(await isEnabled())) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Medium feedback - vote submission */
export async function selectHaptic(): Promise<void> {
  if (!(await isEnabled())) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Heavy feedback - round/game win */
export async function winHaptic(): Promise<void> {
  if (!(await isEnabled())) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
