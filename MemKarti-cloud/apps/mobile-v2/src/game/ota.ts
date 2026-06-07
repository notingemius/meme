// ============================================================================
// Self-hosted OTA updates client (expo-updates) — talks ONLY to our Bunny box.
// ----------------------------------------------------------------------------
// Lets the app pull JS-only updates over the air (no full APK reinstall, no
// expo.dev). The update URL/runtimeVersion are configured in app.json
// (`updates.url` -> https://.../api/manifest, `runtimeVersion` -> "1").
//
// expo-updates only works in release builds (not Expo Go / dev). All calls are
// guarded so they're safe no-ops in dev.
// ============================================================================
import * as Updates from 'expo-updates';

export type OtaResult = 'updated' | 'none' | 'disabled' | 'error';

// Check the server for a newer JS bundle and download it (does NOT reload).
// Returns 'updated' when a new bundle was fetched and is ready to apply.
export async function checkAndFetch(): Promise<OtaResult> {
  // @ts-ignore __DEV__ is a RN global
  if (typeof __DEV__ !== 'undefined' && __DEV__) return 'disabled';
  if (!Updates.isEnabled) return 'disabled';
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return 'none';
    await Updates.fetchUpdateAsync();
    return 'updated';
  } catch {
    return 'error';
  }
}

// Restart the app into the freshly downloaded bundle.
export async function applyUpdate(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch {
    // ignore — caller already handled UX
  }
}

// Convenience: check + fetch + reload in one go (used by the manual button).
export async function checkFetchApply(): Promise<OtaResult> {
  const r = await checkAndFetch();
  if (r === 'updated') await applyUpdate();
  return r;
}

export const otaEnabled = Updates.isEnabled;
