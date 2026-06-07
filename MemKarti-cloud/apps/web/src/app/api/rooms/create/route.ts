import sql from '@/app/api/utils/sql';
import { generateRoomCode, AVATAR_COLORS, dealCardsToPlayer } from '@/app/api/utils/gameLogic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nickname } = body;

    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
      return Response.json({ error: 'Нік обовʼязковий' }, { status: 400 });
    }

    // Generate unique room code
    let code = generateRoomCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await sql`SELECT id FROM rooms WHERE code = ${code}`;
      if (existing.length === 0) break;
      code = generateRoomCode();
      attempts++;
    }

    // Create room
    const [room] = await sql`
      INSERT INTO rooms (code, status, mode, language, target_score)
      VALUES (${code}, 'lobby', 'judge', 'ua', 5)
      RETURNING id, code
    `;

    // Create host player
    const [player] = await sql`
      INSERT INTO players (room_id, nickname, avatar_color)
      VALUES (${room.id}, ${nickname.trim()}, ${AVATAR_COLORS[0]})
      RETURNING id
    `;

    // Set host
    await sql`
      UPDATE rooms SET host_player_id = ${player.id} WHERE id = ${room.id}
    `;

    return Response.json({
      roomId: room.id,
      roomCode: room.code,
      playerId: player.id,
    });
  } catch (e) {
    console.error('create room error', e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
