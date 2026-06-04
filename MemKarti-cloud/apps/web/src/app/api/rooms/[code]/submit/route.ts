import sql from '@/app/api/utils/sql';

// Player submits a meme card for the current round
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { playerId, memeCardId } = body;

    const [room] = await sql`
      SELECT * FROM rooms WHERE code = ${code.toUpperCase()}
    `;
    if (!room) {
      return Response.json({ error: 'Кімнату не знайдено' }, { status: 404 });
    }
    if (room.status !== 'playing') {
      return Response.json({ error: 'Зараз не час обирати' }, { status: 400 });
    }

    // Judge cannot submit in judge mode
    if (room.mode === 'judge' && room.current_judge_id === playerId) {
      return Response.json({ error: 'Ти суддя цього раунду' }, { status: 400 });
    }

    // Check if already submitted
    const existing = await sql`
      SELECT id FROM submissions
      WHERE room_id = ${room.id} AND round_number = ${room.current_round} AND player_id = ${playerId}
    `;
    if (existing.length > 0) {
      return Response.json({ error: 'Ти вже обрав мем' }, { status: 400 });
    }

    // Check meme card is in player's hand
    const [held] = await sql`
      SELECT id FROM player_hands WHERE player_id = ${playerId} AND meme_card_id = ${memeCardId}
    `;
    if (!held) {
      return Response.json({ error: 'Цього мему немає в руці' }, { status: 400 });
    }

    // Create submission and remove from hand
    await sql.transaction([
      sql`
        INSERT INTO submissions (room_id, round_number, player_id, meme_card_id)
        VALUES (${room.id}, ${room.current_round}, ${playerId}, ${memeCardId})
      `,
      sql`DELETE FROM player_hands WHERE id = ${held.id}`,
    ]);

    // Check if all players have submitted (excluding judge)
    const players = await sql`
      SELECT id FROM players WHERE room_id = ${room.id} AND is_active = true
    `;
    const expectedCount = room.mode === 'judge' ? players.length - 1 : players.length;

    const submissionCount = await sql`
      SELECT COUNT(*) as cnt FROM submissions
      WHERE room_id = ${room.id} AND round_number = ${room.current_round}
    `;

    if (Number(submissionCount[0].cnt) >= expectedCount) {
      // Move to judging/voting phase
      await sql`
        UPDATE rooms SET status = 'judging', updated_at = NOW() WHERE id = ${room.id}
      `;
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error('submit error', e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
