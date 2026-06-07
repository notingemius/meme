import sql from '@/app/api/utils/sql';

// Judge picks a winner submission (judge mode)
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { playerId, submissionId } = body;

    const [room] = await sql`
      SELECT * FROM rooms WHERE code = ${code.toUpperCase()}
    `;
    if (!room) {
      return Response.json({ error: 'Кімнату не знайдено' }, { status: 404 });
    }
    if (room.mode !== 'judge') {
      return Response.json({ error: 'Це не режим судді' }, { status: 400 });
    }
    if (room.current_judge_id !== playerId) {
      return Response.json({ error: 'Тільки суддя може обирати' }, { status: 403 });
    }
    if (room.status !== 'judging') {
      return Response.json({ error: 'Зараз не час' }, { status: 400 });
    }

    const [submission] = await sql`
      SELECT * FROM submissions
      WHERE id = ${submissionId} AND room_id = ${room.id} AND round_number = ${room.current_round}
    `;
    if (!submission) {
      return Response.json({ error: 'Submission не знайдено' }, { status: 404 });
    }

    // Mark winner and increment score
    await sql.transaction([
      sql`UPDATE submissions SET is_winner = true WHERE id = ${submissionId}`,
      sql`UPDATE players SET score = score + 1 WHERE id = ${submission.player_id}`,
      sql`UPDATE rooms SET status = 'results', updated_at = NOW() WHERE id = ${room.id}`,
    ]);

    return Response.json({ ok: true });
  } catch (e) {
    console.error('judge error', e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
