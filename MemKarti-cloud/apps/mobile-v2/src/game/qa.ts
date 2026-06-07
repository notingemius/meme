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
