// Single source for the backend URL. Primary = Bunny Magic Containers (DE);
// override at build time via EXPO_PUBLIC_SERVER_URL.
export const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL || 'https://mc-8p1wswn5c6.bunny.run';
