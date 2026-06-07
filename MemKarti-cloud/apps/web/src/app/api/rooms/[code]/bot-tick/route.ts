import sql from '@/app/api/utils/sql';
import { dealCardsToPlayer } from '@/app/api/utils/gameLogic';

const BOT_NAMES = ['МемБот 🤖', 'АвтоГравець', 'РобоМем', 'БотЗнавець', 'МемМашина'];

// Add a bot to the room
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { action } = body; // 'add' | 'tick'

    const [room] = await sql`
      SELECT * FROM rooms WHERE code = ${code.toUpperCase()}
    `;
    if (!room) {
      return Response.json({ error: 'Кімнату не знайдено' }, { status: 404 });
    }

    // === ADD BOT ===
    if (action === 'add') {
      // Check if bot already exists
      const existing = await sql`
        SELECT id FROM players WHERE room_id = ${room.id} AND is_bot = true AND is_active = true
      `;
      if (existing.length > 0) {
        return Response.json({ botId: existing[0].id, ok: true });
      }

      const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
      const [bot] = await sql`
        INSERT INTO players (room_id, nickname, avatar_color, is_bot)
        VALUES (${room.id}, ${botName}, '#6B7280', true)
        RETURNING id
      `;
      return Response.json({ botId: bot.id, ok: true });
    }

    // === TICK: bot takes action based on game state ===
    if (action === 'tick') {
      const [bot] = await sql`
        SELECT id FROM players WHERE room_id = ${room.id} AND is_bot = true AND is_active = true
      `;
      if (!bot) return Response.json({ ok: true, msg: 'no bot' });

      const botId = bot.id;

      // --- PLAYING: bot submits a random meme ---
      if (room.status === 'playing') {
        // Skip if bot is judge in judge mode
        if (room.mode === 'judge' && room.current_judge_id === botId) {
          return Response.json({ ok: true, msg: 'bot is judge, waiting' });
        }

        // Check if already submitted
        const [alreadySubmitted] = await sql`
          SELECT id FROM submissions
          WHERE room_id = ${room.id}
            AND round_number = ${room.current_round}
            AND player_id = ${botId}
        `;
        if (alreadySubmitted) {
          return Response.json({ ok: true, msg: 'already submitted' });
        }

        // Deal cards if bot has none
        const hand = await sql`
          SELECT ph.id as hand_id, ph.meme_card_id
          FROM player_hands ph
          WHERE ph.player_id = ${botId}
        `;
        if (hand.length === 0) {
          await dealCardsToPlayer(botId, 6);
          return Response.json({ ok: true, msg: 'dealt cards, next tick' });
        }

        // Pick random card
        const pick = hand[Math.floor(Math.random() * hand.length)];

        await sql.transaction([
          sql`
            INSERT INTO submissions (room_id, round_number, player_id, meme_card_id)
            VALUES (${room.id}, ${room.current_round}, ${botId}, ${pick.meme_card_id})
          `,
          sql`DELETE FROM player_hands WHERE id = ${pick.hand_id}`,
        ]);

        // Check if all players submitted (excluding judge)
        const players = await sql`
          SELECT id FROM players WHERE room_id = ${room.id} AND is_active = true
        `;
        const expectedCount = room.mode === 'judge' ? players.length - 1 : players.length;

        const [cnt] = await sql`
          SELECT COUNT(*) as cnt FROM submissions
          WHERE room_id = ${room.id} AND round_number = ${room.current_round}
        `;
        if (Number(cnt.cnt) >= expectedCount) {
          await sql`
            UPDATE rooms SET status = 'judging', updated_at = NOW() WHERE id = ${room.id}
          `;
        }
        return Response.json({ ok: true, msg: 'bot submitted' });
      }

      // --- JUDGING: bot judges (judge mode) or votes (vote mode) ---
      if (room.status === 'judging') {
        // Judge mode: if bot is judge, pick random winner
        if (room.mode === 'judge' && room.current_judge_id === botId) {
          const submissions = await sql`
            SELECT id, player_id FROM submissions
            WHERE room_id = ${room.id} AND round_number = ${room.current_round}
          `;
          if (submissions.length === 0) return Response.json({ ok: true });

          const pick = submissions[Math.floor(Math.random() * submissions.length)];
          await sql.transaction([
            sql`UPDATE submissions SET is_winner = true WHERE id = ${pick.id}`,
            sql`UPDATE players SET score = score + 1 WHERE id = ${pick.player_id}`,
            sql`UPDATE rooms SET status = 'results', updated_at = NOW() WHERE id = ${room.id}`,
          ]);
          return Response.json({ ok: true, msg: 'bot judged' });
        }

        // Vote mode: bot votes for random submission (not its own)
        if (room.mode === 'vote') {
          const [alreadyVoted] = await sql`
            SELECT id FROM votes
            WHERE room_id = ${room.id}
              AND round_number = ${room.current_round}
              AND voter_player_id = ${botId}
          `;
          if (alreadyVoted) return Response.json({ ok: true, msg: 'already voted' });

          const eligible = await sql`
            SELECT id, player_id FROM submissions
            WHERE room_id = ${room.id}
              AND round_number = ${room.current_round}
              AND player_id != ${botId}
          `;
          if (eligible.length === 0) return Response.json({ ok: true });

          const pick = eligible[Math.floor(Math.random() * eligible.length)];
          await sql.transaction([
            sql`
              INSERT INTO votes (room_id, round_number, voter_player_id, submission_id)
              VALUES (${room.id}, ${room.current_round}, ${botId}, ${pick.id})
            `,
            sql`UPDATE submissions SET votes = votes + 1 WHERE id = ${pick.id}`,
          ]);

          // Check if all voted
          const submitters = await sql`
            SELECT DISTINCT player_id FROM submissions
            WHERE room_id = ${room.id} AND round_number = ${room.current_round}
          `;
          const [voteCnt] = await sql`
            SELECT COUNT(*) as cnt FROM votes
            WHERE room_id = ${room.id} AND round_number = ${room.current_round}
          `;

          if (Number(voteCnt.cnt) >= submitters.length) {
            const [winner] = await sql`
              SELECT id, player_id FROM submissions
              WHERE room_id = ${room.id} AND round_number = ${room.current_round}
              ORDER BY votes DESC, id ASC
              LIMIT 1
            `;
            if (winner) {
              await sql.transaction([
                sql`UPDATE submissions SET is_winner = true WHERE id = ${winner.id}`,
                sql`UPDATE players SET score = score + 1 WHERE id = ${winner.player_id}`,
                sql`UPDATE rooms SET status = 'results', updated_at = NOW() WHERE id = ${room.id}`,
              ]);
            }
          }
          return Response.json({ ok: true, msg: 'bot voted' });
        }
      }

      return Response.json({ ok: true, msg: 'nothing to do' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('bot-tick error', e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
