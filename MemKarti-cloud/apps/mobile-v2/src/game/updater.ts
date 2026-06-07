// Self-update check via GitHub Releases — no Expo services, no extra native
// modules, no server dependency. Compares the app's baked BUILD_SHA against the
// commit recorded in the latest GitHub release body. If they differ, a newer
// APK is available; we open its public download URL in the browser (the user
// taps the downloaded file to install — same flow as the first install).
import { Linking } from 'react-native';
import { BUILD_SHA, LATEST_RELEASE_API, APK_DOWNLOAD_URL } from '@/config';

export interface UpdateInfo {
  available: boolean;
  currentSha: string;
  latestSha: string | null;
  apkUrl: string;
}

const shortSha = (s: string) => s.trim().toLowerCase().slice(0, 12);

export async function checkForUpdate(): Promise<UpdateInfo> {
  const info: UpdateInfo = {
    available: false,
    currentSha: BUILD_SHA,
    latestSha: null,
    apkUrl: APK_DOWNLOAD_URL,
  };

  // In local dev BUILD_SHA is 'dev' — never prompt for updates.
  if (!BUILD_SHA || BUILD_SHA === 'dev') return info;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return info;

    const data: any = await res.json();

    // The release workflow writes "**Commit:** <full-sha>" into the body.
    const body: string = typeof data?.body === 'string' ? data.body : '';
    const m = body.match(/Commit:\**\s*([0-9a-f]{7,40})/i);
    info.latestSha = m ? m[1] : null;

    // Prefer the real .apk asset URL if present.
    if (Array.isArray(data?.assets)) {
      const apk = data.assets.find(
        (a: any) => typeof a?.name === 'string' && /\.apk$/i.test(a.name),
      );
      if (apk?.browser_download_url) info.apkUrl = apk.browser_download_url;
    }

    if (info.latestSha) {
      info.available = shortSha(info.latestSha) !== shortSha(BUILD_SHA);
    }
    return info;
  } catch {
    // Network/abort errors → just report "no update", never throw.
    return info;
  }
}

export async function openDownload(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    // ignore — nothing we can do if the browser can't open
  }
}
