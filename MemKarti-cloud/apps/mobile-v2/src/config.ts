// Single source for the backend URL. Primary = Bunny Magic Containers (DE);
// override at build time via EXPO_PUBLIC_SERVER_URL.
export const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL || 'https://mc-8p1wswn5c6.bunny.run';

// The commit this APK was built from. Injected by the GitHub Actions build
// (EXPO_PUBLIC_BUILD_SHA = github.sha). Empty in local/dev builds.
export const BUILD_SHA = process.env.EXPO_PUBLIC_BUILD_SHA || '';

// GitHub repository that hosts the APK releases. The in-app updater queries the
// GitHub Releases API directly (no backend needed) to find newer builds.
export const GITHUB_OWNER = 'notingemius';
export const GITHUB_REPO = 'meme';
// The rolling release tag the CI updates on every build of `release-v2`.
export const RELEASE_TAG = 'v2-latest';
