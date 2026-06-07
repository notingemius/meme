// ============================================================================
// Deck client - fetches deck from server, falls back to hardcoded deck.ts.
// ============================================================================

import { SERVER_URL } from '@/config';
import { MEME_CARDS, SITUATIONS, type MemeCard, type Situation } from './deck';
import type { DeckData } from './lanGame';

type ServerDeckResponse = {
  memes: MemeCard[];
  situations: Situation[];
  categories?: Array<{ id: string; name_ua: string; name_ru: string }>;
};

// In-memory cache: once fetched, reuse until app restart.
let cachedDeck: DeckData | null = null;

// The fallback (hardcoded) deck.
const FALLBACK_DECK: DeckData = {
  memes: MEME_CARDS,
  situations: SITUATIONS,
};

/**
 * Fetch deck from server. Returns the dynamic deck if available,
 * otherwise falls back to the embedded deck.ts data.
 */
export async function fetchDeck(): Promise<DeckData> {
  if (cachedDeck) return cachedDeck;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${SERVER_URL}/api/deck`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: ServerDeckResponse = await res.json();

    if (data.memes && data.memes.length > 0 && data.situations && data.situations.length > 0) {
      cachedDeck = { memes: data.memes, situations: data.situations };
      return cachedDeck;
    }
  } catch {
    // Network error, timeout, etc. - use fallback.
  }

  cachedDeck = FALLBACK_DECK;
  return cachedDeck;
}

/**
 * Get the cached deck synchronously. If not yet fetched, returns fallback.
 * Call fetchDeck() first during app init or screen mount.
 */
export function getCachedDeck(): DeckData {
  return cachedDeck ?? FALLBACK_DECK;
}

/**
 * Clear the cache (e.g. on pull-to-refresh or if server pushes a new version).
 */
export function clearDeckCache(): void {
  cachedDeck = null;
}
