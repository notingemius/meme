import sql from '@/app/api/utils/sql';
import { dealCardsToPlayer, pickRandomSituation, pickNextJudge } from '@/app/api/utils/gameLogic';

const HAND_SIZE = 6;

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { playerId } = body;

    const [room] = await sql`
      SELECT * FROM rooms WHERE code = ${code.toUpperCase()}
    `;
    if (!room) {
      return Response.json({ error: 'Кімнату не знайдено' }, { status: 404 });
    }
    if (room.host_player_id !== playerId) {
      return Response.json({ error: 'Тільки хост може почати' }, { status: 403 });
    }
    if (room.status !== 'lobby') {
      return Response.json({ error: 'Гра вже почалась' }, { status: 400 });
    }

    const players = await sql`
      SELECT id FROM players WHERE room_id = ${room.id} AND is_active = true ORDER BY id ASC
    `;

    const minPlayers = room.mode === 'judge' ? 3 : 2;
    if (players.length < minPlayers) {
      return Response.json(
        {
          error:
            room.mode === 'judge'
              ? 'Для режиму суддя потрібно 3+ гравці'
              : 'Потрібно мінімум 2 гравці',
        },
        { status: 400 }
      );
    }

    // Deal cards to each player
    for (const p of players) {
      await dealCardsToPlayer(p.id, HAND_SIZE);
    }

    // Pick first situation and judge
    const situationId = await pickRandomSituation(room.id);
    const judgeId = room.mode === 'judge' ? await pickNextJudge(room.id, null) : null;

    await sql`
      UPDATE rooms
      SET status = 'playing',
          current_round = 1,
          current_situation_id = ${situationId},
          current_judge_id = ${judgeId},
          updated_at = NOW()
      WHERE id = ${room.id}
    `;

    return Response.json({ ok: true });
  } catch (e) {
    console.error('start error', e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
