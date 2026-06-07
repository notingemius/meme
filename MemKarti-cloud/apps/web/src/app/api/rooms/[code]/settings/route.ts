import sql from '@/app/api/utils/sql';

// Update room settings (host only)
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { playerId, mode, language, targetScore } = body;

    const [room] = await sql`
      SELECT id, host_player_id, status FROM rooms WHERE code = ${code.toUpperCase()}
    `;
    if (!room) {
      return Response.json({ error: 'Кімнату не знайдено' }, { status: 404 });
    }

    if (room.host_player_id !== playerId) {
      return Response.json({ error: 'Тільки хост може змінювати' }, { status: 403 });
    }

    if (room.status !== 'lobby') {
      return Response.json({ error: 'Гра вже почалась' }, { status: 400 });
    }

    // Build dynamic update
    const updates: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (mode === 'judge' || mode === 'vote') {
      updates.push(`mode = $${i++}`);
      values.push(mode);
    }
    if (language === 'ua' || language === 'ru') {
      updates.push(`language = $${i++}`);
      values.push(language);
    }
    if (typeof targetScore === 'number' && targetScore >= 3 && targetScore <= 15) {
      updates.push(`target_score = $${i++}`);
      values.push(targetScore);
    }

    if (updates.length === 0) {
      return Response.json({ ok: true });
    }

    updates.push(`updated_at = NOW()`);
    values.push(room.id);
    const query = `UPDATE rooms SET ${updates.join(', ')} WHERE id = $${i}`;
    await sql(query, values);

    return Response.json({ ok: true });
  } catch (e) {
    console.error('settings error', e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
