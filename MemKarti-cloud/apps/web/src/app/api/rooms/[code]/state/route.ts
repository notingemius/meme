import sql from '@/app/api/utils/sql';

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const url = new URL(request.url);
    const playerIdParam = url.searchParams.get('playerId');
    const playerId = playerIdParam ? parseInt(playerIdParam, 10) : null;

    const [room] = await sql`
      SELECT * FROM rooms WHERE code = ${code.toUpperCase()}
    `;
    if (!room) {
      return Response.json({ error: 'Кімнату не знайдено' }, { status: 404 });
    }

    // Update last_seen for player
    if (playerId) {
      await sql`
        UPDATE players SET last_seen = NOW() WHERE id = ${playerId}
      `;
    }

    const players = await sql`
      SELECT id, nickname, score, avatar_color, is_active, is_bot
      FROM players
      WHERE room_id = ${room.id}
      ORDER BY id ASC
    `;

    let situation = null;
    if (room.current_situation_id) {
      const [s] = await sql`
        SELECT id, text_ua, text_ru FROM situations WHERE id = ${room.current_situation_id}
      `;
      situation = s;
    }

    // Player's hand
    let hand: any[] = [];
    if (playerId) {
      hand = await sql`
        SELECT ph.id as hand_id, mc.id as meme_id, mc.image_url, mc.title
        FROM player_hands ph
        JOIN meme_cards mc ON mc.id = ph.meme_card_id
        WHERE ph.player_id = ${playerId}
      `;
    }

    // Submissions for current round
    const submissions = await sql`
      SELECT s.id, s.player_id, s.meme_card_id, s.votes, s.is_winner,
             mc.image_url, mc.title, p.nickname, p.avatar_color
      FROM submissions s
      JOIN meme_cards mc ON mc.id = s.meme_card_id
      JOIN players p ON p.id = s.player_id
      WHERE s.room_id = ${room.id} AND s.round_number = ${room.current_round}
      ORDER BY s.id ASC
    `;

    // Hide who submitted what until the round is revealed (results/finished).
    // Fix: раніше автори розкривались вже на фазі 'judging', що ломало анонімність для судді.
    const hideAuthors = room.status !== 'results' && room.status !== 'finished';
    const safeSubmissions = submissions.map((s: any) => ({
      id: s.id,
      meme_card_id: s.meme_card_id,
      image_url: s.image_url,
      title: s.title,
      votes: s.votes,
      is_winner: s.is_winner,
      player_id: hideAuthors ? null : s.player_id,
      nickname: hideAuthors ? null : s.nickname,
      avatar_color: hideAuthors ? null : s.avatar_color,
      is_my_submission: playerId === s.player_id,
    }));

    // Has current player submitted?
    let hasSubmitted = false;
    if (playerId) {
      const mine = submissions.find((s: any) => s.player_id === playerId);
      hasSubmitted = !!mine;
    }

    // Has current player voted? (vote mode)
    let hasVoted = false;
    if (playerId && room.mode === 'vote') {
      const [v] = await sql`
        SELECT id FROM votes
        WHERE room_id = ${room.id}
          AND round_number = ${room.current_round}
          AND voter_player_id = ${playerId}
      `;
      hasVoted = !!v;
    }

    return Response.json({
      room: {
        id: room.id,
        code: room.code,
        status: room.status,
        mode: room.mode,
        language: room.language,
        target_score: room.target_score,
        current_round: room.current_round,
        current_judge_id: room.current_judge_id,
        host_player_id: room.host_player_id,
      },
      players,
      situation,
      hand,
      submissions: safeSubmissions,
      hasSubmitted,
      hasVoted,
    });
  } catch (e) {
    console.error('state error', e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
