import sql from '@/app/api/utils/sql';

// Player votes for a submission (vote mode)
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
    if (room.mode !== 'vote') {
      return Response.json({ error: 'Це не режим голосування' }, { status: 400 });
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

    // Can't vote for own submission
    if (submission.player_id === playerId) {
      return Response.json({ error: 'Не можна голосувати за себе' }, { status: 400 });
    }

    // Check if already voted
    const existing = await sql`
      SELECT id FROM votes
      WHERE room_id = ${room.id}
        AND round_number = ${room.current_round}
        AND voter_player_id = ${playerId}
    `;
    if (existing.length > 0) {
      return Response.json({ error: 'Ти вже проголосував' }, { status: 400 });
    }

    await sql.transaction([
      sql`
        INSERT INTO votes (room_id, round_number, voter_player_id, submission_id)
        VALUES (${room.id}, ${room.current_round}, ${playerId}, ${submissionId})
      `,
      sql`UPDATE submissions SET votes = votes + 1 WHERE id = ${submissionId}`,
    ]);

    // Check if all eligible players voted
    const players = await sql`
      SELECT id FROM players WHERE room_id = ${room.id} AND is_active = true
    `;

    const submissions = await sql`
      SELECT id, player_id FROM submissions
      WHERE room_id = ${room.id} AND round_number = ${room.current_round}
    `;
    const submitterIds = new Set(submissions.map((s: any) => s.player_id));

    const votes = await sql`
      SELECT id FROM votes
      WHERE room_id = ${room.id} AND round_number = ${room.current_round}
    `;

    // Everyone who submitted should vote (excluding themselves voting for self)
    // Voters = submitters
    if (votes.length >= submitterIds.size) {
      // Find winner (most votes; ties broken by earliest submission)
      const ranked = await sql`
        SELECT id, player_id, votes
        FROM submissions
        WHERE room_id = ${room.id} AND round_number = ${room.current_round}
        ORDER BY votes DESC, id ASC
      `;
      if (ranked.length > 0) {
        const winner = ranked[0];
        await sql.transaction([
          sql`UPDATE submissions SET is_winner = true WHERE id = ${winner.id}`,
          sql`UPDATE players SET score = score + 1 WHERE id = ${winner.player_id}`,
          sql`UPDATE rooms SET status = 'results', updated_at = NOW() WHERE id = ${room.id}`,
        ]);
      }
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error('vote error', e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
