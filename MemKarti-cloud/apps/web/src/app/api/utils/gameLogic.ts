import sql from '@/app/api/utils/sql';

// Generate a random 6-character room code
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Avatar colors palette
export const AVATAR_COLORS = [
  '#2563EB', // blue
  '#EA580C', // orange
  '#16A34A', // green
  '#DC2626', // red
  '#9333EA', // purple
  '#0891B2', // cyan
  '#CA8A04', // amber
  '#DB2777', // pink
  '#65A30D', // lime
  '#0284C7', // sky
];

// Deal N random meme cards to a player
export async function dealCardsToPlayer(playerId: number, count: number): Promise<void> {
  // Get all available meme cards
  const allMemes = await sql`SELECT id FROM meme_cards`;
  if (allMemes.length === 0) return;

  // Get player's current hand
  const currentHand = await sql`
    SELECT meme_card_id FROM player_hands WHERE player_id = ${playerId}
  `;
  const heldIds = new Set(currentHand.map((c: any) => c.meme_card_id));

  // Pick random cards not already in hand
  const available = allMemes.filter((m: any) => !heldIds.has(m.id));
  const shuffled = available.sort(() => Math.random() - 0.5);
  const toDeal = shuffled.slice(0, count);

  for (const meme of toDeal) {
    await sql`
      INSERT INTO player_hands (player_id, meme_card_id)
      VALUES (${playerId}, ${meme.id})
    `;
  }
}

// Pick a random situation that hasn't been used yet in this room
export async function pickRandomSituation(roomId: number): Promise<number | null> {
  const all = await sql`SELECT id FROM situations`;
  if (all.length === 0) return null;
  const random = all[Math.floor(Math.random() * all.length)];
  return random.id;
}

// Calculate next judge (rotate through active players)
export async function pickNextJudge(
  roomId: number,
  currentJudgeId: number | null
): Promise<number | null> {
  const players = await sql`
    SELECT id FROM players WHERE room_id = ${roomId} AND is_active = true ORDER BY id ASC
  `;
  if (players.length === 0) return null;
  if (!currentJudgeId) return players[0].id;
  const currentIdx = players.findIndex((p: any) => p.id === currentJudgeId);
  const nextIdx = (currentIdx + 1) % players.length;
  return players[nextIdx].id;
}
