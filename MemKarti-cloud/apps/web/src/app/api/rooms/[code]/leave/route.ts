import sql from '@/app/api/utils/sql';

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { playerId } = body;

    const [room] = await sql`
      SELECT id FROM rooms WHERE code = ${code.toUpperCase()}
    `;
    if (!room) return Response.json({ ok: true });

    await sql`
      UPDATE players SET is_active = false WHERE id = ${playerId} AND room_id = ${room.id}
    `;

    return Response.json({ ok: true });
  } catch (e) {
    console.error('leave error', e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
