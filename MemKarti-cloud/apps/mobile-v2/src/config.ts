// Single source for the backend URL. Primary = Bunny Magic Containers (DE);
// override at build time via EXPO_PUBLIC_SERVER_URL.
export const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL || 'https://mc-8p1wswn5c6.bunny.run';

// --- Self-update (no Expo / no Bunny dependency) -------------------------
// The app checks GitHub Releases directly to know if a newer APK exists.
// BUILD_SHA is baked in at build time by the release workflow
// (EXPO_PUBLIC_BUILD_SHA = github.sha). In local dev it stays 'dev', and the
// update check is silently skipped so it never nags during development.
export const BUILD_SHA = process.env.EXPO_PUBLIC_BUILD_SHA || 'dev';

export const GITHUB_REPO = 'notingemius/meme';
export const RELEASE_TAG = 'v2-latest';

// Public GitHub API — no auth needed for a public repo's release.
export const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${RELEASE_TAG}`;
// Stable download link (same URL always points at the freshest APK).
export const APK_DOWNLOAD_URL = `https://github.com/${GITHUB_REPO}/releases/download/${RELEASE_TAG}/MemKarti-v2.apk`;
