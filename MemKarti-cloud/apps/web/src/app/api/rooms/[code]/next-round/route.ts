import sql from '@/app/api/utils/sql';
import { dealCardsToPlayer, pickRandomSituation, pickNextJudge } from '@/app/api/utils/gameLogic';

const HAND_SIZE = 6;

// Advance to next round (any player can trigger)
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;

    const [room] = await sql`
      SELECT * FROM rooms WHERE code = ${code.toUpperCase()}
    `;
    if (!room) {
      return Response.json({ error: 'Кімнату не знайдено' }, { status: 404 });
    }
    if (room.status !== 'results') {
      return Response.json({ error: 'Раунд ще не закінчився' }, { status: 400 });
    }

    // Check if any player reached target score
    const winners = await sql`
      SELECT id, nickname, score FROM players
      WHERE room_id = ${room.id} AND score >= ${room.target_score}
      ORDER BY score DESC
    `;

    if (winners.length > 0) {
      await sql`
        UPDATE rooms SET status = 'finished', updated_at = NOW() WHERE id = ${room.id}
      `;
      return Response.json({ ok: true, finished: true });
    }

    // Refill hands
    const players = await sql`
      SELECT id FROM players WHERE room_id = ${room.id} AND is_active = true
    `;
    for (const p of players) {
      const hand = await sql`
        SELECT COUNT(*) as cnt FROM player_hands WHERE player_id = ${p.id}
      `;
      const need = HAND_SIZE - Number(hand[0].cnt);
      if (need > 0) {
        await dealCardsToPlayer(p.id, need);
      }
    }

    const newSituationId = await pickRandomSituation(room.id);
    const newJudgeId =
      room.mode === 'judge' ? await pickNextJudge(room.id, room.current_judge_id) : null;

    await sql`
      UPDATE rooms
      SET status = 'playing',
          current_round = current_round + 1,
          current_situation_id = ${newSituationId},
          current_judge_id = ${newJudgeId},
          updated_at = NOW()
      WHERE id = ${room.id}
    `;

    return Response.json({ ok: true });
  } catch (e) {
    console.error('next round error', e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
