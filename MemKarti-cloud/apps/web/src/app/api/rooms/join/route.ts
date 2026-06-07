import sql from '@/app/api/utils/sql';
import { AVATAR_COLORS } from '@/app/api/utils/gameLogic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nickname, roomCode } = body;

    if (!nickname || !roomCode) {
      return Response.json({ error: 'Введи нік та код кімнати' }, { status: 400 });
    }

    const code = String(roomCode).trim().toUpperCase();

    const [room] = await sql`
      SELECT id, code, status FROM rooms WHERE code = ${code}
    `;
    if (!room) {
      return Response.json({ error: 'Кімнату не знайдено' }, { status: 404 });
    }

    if (room.status !== 'lobby') {
      return Response.json({ error: 'Гра вже почалась' }, { status: 400 });
    }

    // Check existing players to pick a unique color
    const existing = await sql`
      SELECT avatar_color FROM players WHERE room_id = ${room.id}
    `;
    const used = new Set(existing.map((p: any) => p.avatar_color));
    const availableColor =
      AVATAR_COLORS.find((c) => !used.has(c)) ||
      AVATAR_COLORS[existing.length % AVATAR_COLORS.length];

    if (existing.length >= 10) {
      return Response.json({ error: 'Кімната повна' }, { status: 400 });
    }

    const [player] = await sql`
      INSERT INTO players (room_id, nickname, avatar_color)
      VALUES (${room.id}, ${String(nickname).trim()}, ${availableColor})
      RETURNING id
    `;

    return Response.json({
      roomId: room.id,
      roomCode: room.code,
      playerId: player.id,
    });
  } catch (e) {
    console.error('join room error', e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
