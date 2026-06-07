// QA helper: report a "bad" meme to the server so we can curate the deck.
// Works in any mode (solo / Wi-Fi / online) — it just POSTs to the backend.
import { SERVER_URL } from '@/config';
import type { MemeCard } from '@/game/deck';

export async function reportBadMeme(
  meme: MemeCard,
  context?: { phase?: string; situation?: string; by?: string },
): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/qa/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memeId: meme.id,
        title: meme.title,
        imageUrl: meme.image_url,
        phase: context?.phase,
        situation: context?.situation,
        by: context?.by,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Review screen: fetch the set of meme ids already marked as bad on the server.
export async function fetchFlaggedIds(): Promise<Set<number>> {
  try {
    const res = await fetch(`${SERVER_URL}/qa/flagged-ids`);
    if (!res.ok) return new Set();
    const data = await res.json();
    return new Set<number>(Array.isArray(data.ids) ? data.ids : []);
  } catch {
    return new Set();
  }
}

// Review screen: un-mark a meme (remove its flags on the server).
export async function unflagMeme(memeId: number): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/qa/unflag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memeId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
