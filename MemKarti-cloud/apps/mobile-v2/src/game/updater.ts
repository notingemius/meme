// ============================================================================
// In-app OTA updater — fully on your own infrastructure (GitHub), no Expo/EAS
// services. It asks the GitHub Releases API which commit the latest APK was
// built from, compares it to this build's BUILD_SHA, and (if newer) downloads
// the APK and launches the Android package installer.
//
// Flow on the phone:
//   1. checkForUpdate()  -> is there a newer build than mine?
//   2. downloadAndInstall(url, onProgress) -> fetch APK, open system installer
//
// The user only needs to allow "install from unknown sources" once.
// ============================================================================
import { Platform } from 'react-native';
// Legacy FS API: stable downloadResumable + getContentUriAsync (SDK 54).
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { BUILD_SHA, GITHUB_OWNER, GITHUB_REPO, RELEASE_TAG } from '@/config';

const API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

export type UpdateInfo = {
  available: boolean;
  remoteSha: string | null; // commit the latest APK was built from
  apkUrl: string | null; // direct .apk download link
  sizeMb: number | null;
  publishedAt: string | null;
  tag: string;
};

const NO_UPDATE: UpdateInfo = {
  available: false,
  remoteSha: null,
  apkUrl: null,
  sizeMb: null,
  publishedAt: null,
  tag: RELEASE_TAG,
};

async function getJson(url: string): Promise<any | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function sameCommit(a: string, b: string): boolean {
  if (!a || !b) return false;
  // github.sha is the full 40-char hash; compare leniently (one may be short).
  return a === b || a.startsWith(b) || b.startsWith(a);
}

/**
 * Extracts the built commit SHA from a release body. The CI writes a line:
 *   - **Commit:** <github.sha>
 * which is EXACTLY the value embedded as BUILD_SHA at build time. This is the
 * only reliable source — the rolling git tag ref can lag behind the actual
 * build, which previously made the update button light up permanently.
 */
function commitFromBody(body: unknown): string | null {
  if (typeof body !== 'string') return null;
  const m = body.match(/Commit:\**\s*`?([0-9a-f]{7,40})`?/i);
  return m ? m[1] : null;
}

/**
 * Returns whether a newer APK than the running build exists.
 * Strategy: read the release for RELEASE_TAG to get the APK asset, then learn
 * the exact commit the APK was built from — primarily from the release body
 * ("Commit: <sha>"), falling back to the git tag ref / target_commitish.
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
  // 1) The release that carries the APK asset.
  const release = await getJson(`${API}/releases/tags/${RELEASE_TAG}`);
  if (!release || !Array.isArray(release.assets)) return NO_UPDATE;

  const apkAsset = release.assets.find(
    (a: any) => typeof a?.name === 'string' && a.name.toLowerCase().endsWith('.apk'),
  );
  if (!apkAsset?.browser_download_url) return NO_UPDATE;

  // 2) The commit the APK was actually built from. The body's "Commit:" line is
  //    authoritative (= EXPO_PUBLIC_BUILD_SHA = github.sha). Only if it's
  //    missing do we fall back to the (sometimes stale) tag ref.
  let remoteSha: string | null = commitFromBody(release.body);
  if (!remoteSha) {
    const ref = await getJson(`${API}/git/refs/tags/${RELEASE_TAG}`);
    remoteSha = ref?.object?.sha ?? release.target_commitish ?? null;
  }

  const info: UpdateInfo = {
    available: false,
    remoteSha,
    apkUrl: apkAsset.browser_download_url,
    sizeMb: apkAsset.size ? Math.round((apkAsset.size / 1024 / 1024) * 10) / 10 : null,
    publishedAt: release.published_at ?? null,
    tag: release.tag_name ?? RELEASE_TAG,
  };

  // Without a known local build sha (dev builds) we never nag the user.
  if (!BUILD_SHA || !remoteSha) {
    info.available = false;
    return info;
  }
  info.available = !sameCommit(remoteSha, BUILD_SHA);
  return info;
}

export type DownloadProgress = (fraction: number) => void;

/**
 * Downloads the APK with progress and launches the Android installer.
 * Throws on failure so the UI can surface a message.
 */
export async function downloadAndInstall(
  apkUrl: string,
  onProgress?: DownloadProgress,
): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('Оновлення через застосунок доступне лише на Android');
  }

  const dest = `${FileSystem.cacheDirectory}MemKarti-update.apk`;
  // Remove a stale partial download if present.
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  } catch {
    /* ignore */
  }

  const resumable = FileSystem.createDownloadResumable(
    apkUrl,
    dest,
    {},
    (p) => {
      if (onProgress && p.totalBytesExpectedToWrite > 0) {
        onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
      }
    },
  );

  const result = await resumable.downloadAsync();
  if (!result?.uri) throw new Error('Не вдалося завантажити APK');

  // Hand a content:// URI to the system package installer.
  const contentUri = await FileSystem.getContentUriAsync(result.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
  });
}
