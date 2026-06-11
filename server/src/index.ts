// ============================================================================
// MemKarti online multiplayer server.
// ----------------------------------------------------------------------------
// Express (health checks) + Socket.IO (realtime rooms). All game rules come
// from the shared engine (./engine -> apps/mobile-v2/src/game/lanGame.ts).
//
// Per-player state: every socket receives its OWN ClientView (via viewForPlayer)
// so hands are never leaked to opponents — identical to the LAN transport.
// ============================================================================

import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server, type Socket } from 'socket.io';
import { RoomManager, type Room } from './rooms';
import { botsSubmit, botsVote } from './engine';
import { loadFlags, addFlag, setFlagOnce, removeFlags, allFlags, flaggedIds, summary, toCsv } from './qa';
import { manifestHandler, assetHandler, otaAvailable, OTA_INFO } from './ota';
import { loadDeck, getDeck, addMemes, removeMeme, removeMemesByTitle, addSituations, removeSituation, type SituationWithCategory } from './deck-store';
import { loadProfiles, getOrCreateProfile, getProfileById, updateNickname, recordGameResult } from './profiles';
import { loadLeaderboard, recordFriends, getFriendsLeaderboard } from './leaderboard';
import type { MemeCard } from './engine';

const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(cors());
app.use(express.json());

const manager = new RoomManager();

// --- health / info endpoints (Render pings these, friends can sanity-check) --
app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'memkarti-server', rooms: manager.roomCount });
});
app.get('/health', (_req, res) => res.json({ ok: true }));

// --- Self-hosted OTA updates (Expo Updates protocol) ------------------------
// JS-only updates delivered over the air from this server (no expo.dev / EAS,
// no full APK reinstall). Bundle is baked into the image at OTA_DIST_DIR.
app.get('/api/manifest', manifestHandler);
app.get('/api/assets', assetHandler);
app.get('/ota/status', (_req, res) => {
  res.json({ available: otaAvailable(), runtimeVersion: OTA_INFO.runtimeVersion, dir: OTA_INFO.dir });
});

// --- Dynamic deck API -------------------------------------------------------
// Load deck from /data on startup
loadDeck();
// Load profiles from /data on startup
loadProfiles();
// Load leaderboard from /data on startup
loadLeaderboard();

// --- Meme Shop: browse memes from external sources, pick favorites, add to deck
// Curated list of SINGLE-REACTION memes from multiple sources (KYM CDN,
// imgflip, Wikipedia, etc.) that are known to return HTTP 200.
const CURATED_SHOP_MEMES: Array<{ title: string; image_url: string; source: string }> = [
  // KYM CDN — Wojak/Pepe/Chad family (одиночные реакции)
  { title: 'Wojak Crying', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/883/586/63f.jpg' },
  { title: 'Chad Yes Meme', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/650/747/aaf.png' },
  { title: 'Soyjak Pointing Two', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/937/655/73c.jpg' },
  { title: 'Doomer Wojak Face', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/632/306/a8f.jpg' },
  { title: 'Giga Chad Photo', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/562/650/cd0.jpg' },
  { title: 'Big Brain Time', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/534/991/18e.jpg' },
  { title: 'Brainlet Small Brain', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/328/854/8d6.jpg' },
  { title: 'Angry NPC Wojak', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/421/934/795.jpg' },
  { title: 'Pepe Sad Sitting', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/000/862/065/0e9.jpg' },
  { title: 'Smug Pepe Face', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/236/841/075.jpg' },
  { title: 'Crying Pepe Tears', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/000/948/911/ed7.jpg' },
  { title: 'Pepe Laughing Hard', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/839/575/d69.jpg' },
  // KYM CDN — популярні реакції
  { title: 'Surprised Tom HD', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/485/098/245.png' },
  { title: 'You Dare Use My Spells', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/535/017/c85.jpg' },
  { title: 'Squidward Exhausted', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/060/689/927.jpg' },
  { title: 'Patrick Evil Grin', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/371/723/be6.jpg' },
  { title: 'Obama Giving Medal Self', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/056/730/597.jpg' },
  { title: 'Drew Scanlon Blinking', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/207/210/b22.jpg' },
  { title: 'Holding Back Tears', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/096/564/2f7.jpg' },
  { title: 'Monkey Looking Away', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/471/227/dd0.png' },
  { title: 'Markiplier E Meme', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/365/818/183.jpg' },
  { title: 'Skeleton Waiting Bench', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/000/628/148/b04.jpg' },
  { title: 'Math Lady Calculating', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/229/007/4c9.jpg' },
  { title: 'Zach Galifianakis Math', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/000/517/111/fbd.jpg' },
  { title: 'John Travolta Confused Pulp', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/042/619/4ea.jpg' },
  { title: 'Cat Nervous Sweating', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/000/565/399/9c0.jpg' },
  { title: 'Larry David Unsure', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/021/311/free.jpg' },
  { title: 'Roll Safe Thinking', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/022/138/highresrollsafe.jpg' },
  { title: 'Confused Nick Young Photo', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/018/489/nick-young-confused-face-300x256-nqlyaa.jpg' },
  { title: 'Suspicious Fry Squint', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/006/026/NOTSUREIF.jpg' },
  { title: 'Overly Attached Girl', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/010/496/Overly_attached_GF.jpg' },
  { title: 'Forever Alone Face', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/003/619/ForeverAlone.jpg' },
  { title: 'Shut Up Take My Money', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/005/574/takemymoney.jpg' },
  { title: 'Me Gusta Rage', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/002/252/NoMeGusta.jpg' },
  { title: 'Okay Face Rage', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/003/617/OkayGuy.jpg' },
  { title: 'Classic Troll Face', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/000/091/TrollFace.jpg' },
  { title: 'Not Bad Obama Face', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/006/151/ObamaNotBad.jpg' },
  { title: 'If You Know What I Mean', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/008/549/ifuknowwhatimean.jpg' },
  { title: 'Ancient Aliens Giorgio', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/005/848/Aliens.jpg' },
  { title: 'Doge Original Shiba', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/013/564/doge.jpg' },
  { title: 'Philosoraptor Thinking', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/000/509/800px-Philosoraptor2.jpg' },
  { title: 'Success Baby Fist', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/000/745/success.jpg' },
  { title: 'Disaster Girl Fire', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/000/043/disaster-girl.jpg' },
  { title: 'Surprised Pikachu Full', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/027/475/Screen_Shot_2018-10-25_at_11.02.15_AM.png' },
  { title: 'Gandalf Meme Wizard', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/000/117/814/are-you-wizard.jpg' },
  { title: 'Dog In Disaster', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/401/347/312.jpg' },
  { title: 'Distracted Boyfriend Back', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/photos/images/newsfeed/001/293/670/b7d.jpg' },
  { title: 'Two Spidermen', source: 'knowyourmeme', image_url: 'https://i.kym-cdn.com/entries/icons/original/000/023/397/C-658VsXoAo3ovC.jpg' },
  // Wikipedia / Wikimedia
  { title: 'Pepe Feels Good Original', source: 'wikimedia', image_url: 'https://upload.wikimedia.org/wikipedia/en/6/63/Feels_good_man.jpg' },
  // Imgflip (дополнительные одиночные через прямые URL)
  { title: 'Waiting Skeleton Meme', source: 'imgflip', image_url: 'https://i.imgflip.com/2fm6x.jpg' },
  { title: 'Grandma Internet', source: 'imgflip', image_url: 'https://i.imgflip.com/1bhf.jpg' },
  { title: 'Star Wars Yoda', source: 'imgflip', image_url: 'https://i.imgflip.com/8k0sa.jpg' },
  { title: 'Unsettled Tom Face', source: 'imgflip', image_url: 'https://i.imgflip.com/2wifvo.jpg' },
  { title: 'Arthur Fist Punch', source: 'imgflip', image_url: 'https://i.imgflip.com/17fgbh.jpg' },
  { title: 'Pretending To Be Happy', source: 'imgflip', image_url: 'https://i.imgflip.com/2fbnm4.jpg' },
  { title: 'Third World Success', source: 'imgflip', image_url: 'https://i.imgflip.com/1a3t.jpg' },
  { title: 'Computer Guy Facepalm', source: 'imgflip', image_url: 'https://i.imgflip.com/14y.jpg' },
  { title: 'Scared Cat Meme', source: 'imgflip', image_url: 'https://i.imgflip.com/2w7pf5.jpg' },
  { title: 'Cat In The Hat', source: 'imgflip', image_url: 'https://i.imgflip.com/3prze1.jpg' },
  { title: 'Angry Pakistani Fan', source: 'imgflip', image_url: 'https://i.imgflip.com/3c3rig.jpg' },
];

// Subreddits the meme shop pulls from — varied themes/cultures, mostly
// single-image memes (films, cartoons, reactions, wholesome, history, anime).
const SHOP_SUBREDDITS = [
  'memes', 'dankmemes', 'wholesomememes', 'me_irl', 'reactionmemes',
  'PrequelMemes', 'marvelstudiosmemes', 'lotrmemes', 'historymemes',
  'animemes', 'cats', 'funny', 'MemeReactions', 'comedyheaven',
  'AdviceAnimals', 'terriblefacebookmemes', 'fffffffuuuuuuuuuuuu',
];

app.get('/api/meme-shop', async (_req, res) => {
  try {
    const deck = getDeck();
    const existingUrls = new Set(deck.memes.map((m) => m.image_url));
    const existingTitles = new Set(deck.memes.map((m) => (m.title || '').toLowerCase().trim()));

    // Source 1: Reddit (meme-api.com) — BIG, self-refreshing pool across many
    // subreddits (films, cartoons, reactions, different cultures). Each request
    // returns fresh memes, so the shop never runs out.
    const pick = [...SHOP_SUBREDDITS].sort(() => Math.random() - 0.5).slice(0, 7);
    const redditResults = await Promise.allSettled(
      pick.map(async (sub) => {
        const r = await fetch(`https://meme-api.com/gimme/${sub}/30`, {
          signal: AbortSignal.timeout(7000),
        });
        const d = (await r.json()) as any;
        return ((d?.memes ?? []) as any[])
          .filter((m) => !m.nsfw && /\.(jpg|jpeg|png)$/i.test(m.url || ''))
          .map((m) => ({ title: m.title || sub, image_url: m.url as string, source: `reddit/${sub}` }));
      }),
    );
    const reddit = redditResults.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

    // Source 2: imgflip API (100 top templates — reliable CDN)
    let imgflipMemes: Array<{ title: string; image_url: string; source: string }> = [];
    try {
      const resp = await fetch('https://api.imgflip.com/get_memes', { signal: AbortSignal.timeout(8000) });
      const data = (await resp.json()) as any;
      imgflipMemes = (data?.data?.memes ?? []).map((m: any) => ({
        title: m.name,
        image_url: m.url,
        source: 'imgflip',
      }));
    } catch { /* imgflip down — skip */ }

    // Source 3: curated list (KYM CDN, Wikimedia, extra imgflip)
    const curated = CURATED_SHOP_MEMES;

    // Combine all sources, dedupe by URL, tag whether already in the deck.
    // We DON'T hide in-deck memes — the shop shows the full library so it never
    // looks empty; in-deck items are just marked and not selectable.
    // New (reddit) first so fresh content is on top.
    const seen = new Set<string>();
    const all: Array<{ title: string; image_url: string; source: string; inDeck: boolean }> = [];
    for (const m of [...reddit, ...curated, ...imgflipMemes]) {
      if (!m.image_url || seen.has(m.image_url)) continue;
      seen.add(m.image_url);
      const inDeck = existingUrls.has(m.image_url);
      all.push({ ...m, inDeck });
    }
    // New (not in deck) first, then already-added.
    all.sort((a, b) => Number(a.inDeck) - Number(b.inDeck));

    const newCount = all.filter((m) => !m.inDeck).length;
    res.json({
      available: all,
      newCount,
      totalInDeck: deck.memes.length,
      sources: ['reddit', 'imgflip', 'knowyourmeme', 'wikimedia'],
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch memes from sources' });
  }
});

// Public: fetch the full deck (memes, situations, categories).
app.get('/api/deck', (_req, res) => {
  res.json(getDeck());
});

// Public: fetch memes only.
app.get('/api/deck/memes', (_req, res) => {
  res.json({ memes: getDeck().memes });
});

// Public: fetch situations only.
app.get('/api/deck/situations', (_req, res) => {
  res.json({ situations: getDeck().situations, categories: getDeck().categories });
});

// Admin: add memes.
app.post('/api/deck/memes', (req, res) => {
  const body = req.body;
  if (!Array.isArray(body?.memes)) {
    return res.status(400).json({ error: 'body.memes (array) required' });
  }
  const memes = body.memes as MemeCard[];
  const deck = addMemes(memes);
  res.json({ ok: true, totalMemes: deck.memes.length });
});

// Admin: remove a meme by id.
app.delete('/api/deck/memes/:id', (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  const deck = removeMeme(id);
  res.json({ ok: true, totalMemes: deck.memes.length });
});

// Admin: remove meme(s) by title (for memes added without id).
app.post('/api/deck/memes/remove-by-title', (req, res) => {
  const titles: string[] = req.body?.titles;
  if (!Array.isArray(titles) || titles.length === 0) {
    return res.status(400).json({ error: 'body.titles (string[]) required' });
  }
  const { deck, removed } = removeMemesByTitle(titles);
  res.json({ ok: true, removed, totalMemes: deck.memes.length });
});

// Admin: add situations.
app.post('/api/deck/situations', (req, res) => {
  const body = req.body;
  if (!Array.isArray(body?.situations)) {
    return res.status(400).json({ error: 'body.situations (array) required' });
  }
  const situations = body.situations as SituationWithCategory[];
  const deck = addSituations(situations);
  res.json({ ok: true, totalSituations: deck.situations.length });
});

// Admin: remove a situation by id.
app.delete('/api/deck/situations/:id', (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  const deck = removeSituation(id);
  res.json({ ok: true, totalSituations: deck.situations.length });
});

// --- Player profiles API ----------------------------------------------------
// POST /api/profiles - create or get profile by deviceId
app.post('/api/profiles', (req, res) => {
  const { deviceId, nickname } = req.body ?? {};
  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ error: 'deviceId (string) is required' });
  }
  const profile = getOrCreateProfile(deviceId, nickname);
  res.json(profile);
});

// GET /api/profiles/:id - get profile by id
app.get('/api/profiles/:id', (req, res) => {
  const profile = getProfileById(req.params.id);
  if (!profile) return res.status(404).json({ error: 'profile not found' });
  res.json(profile);
});

// PATCH /api/profiles/:id - update nickname
app.patch('/api/profiles/:id', (req, res) => {
  const { nickname } = req.body ?? {};
  if (!nickname || typeof nickname !== 'string') {
    return res.status(400).json({ error: 'nickname (string) is required' });
  }
  const profile = updateNickname(req.params.id, nickname);
  if (!profile) return res.status(404).json({ error: 'profile not found' });
  res.json(profile);
});

// POST /api/profiles/:id/game-result - record game result
app.post('/api/profiles/:id/game-result', (req, res) => {
  const { won, roundsPlayed } = req.body ?? {};
  if (typeof won !== 'boolean') {
    return res.status(400).json({ error: 'won (boolean) is required' });
  }
  const rounds = typeof roundsPlayed === 'number' ? roundsPlayed : 0;
  const profile = recordGameResult(req.params.id, won, rounds);
  if (!profile) return res.status(404).json({ error: 'profile not found' });
  res.json(profile);
});

// --- Leaderboard (friends) API -----------------------------------------------
// GET /api/leaderboard/:profileId - returns friends sorted by gamesWon
app.get('/api/leaderboard/:profileId', (req, res) => {
  const entries = getFriendsLeaderboard(req.params.profileId);
  res.json({ leaderboard: entries });
});

// POST /api/friends/record - called at game end to record friend relationships
app.post('/api/friends/record', (req, res) => {
  const { profileIds } = req.body ?? {};
  if (!Array.isArray(profileIds) || profileIds.length < 2) {
    return res.status(400).json({ error: 'profileIds (array of at least 2) is required' });
  }
  recordFriends(profileIds);
  res.json({ ok: true });
});

// --- Deep link redirect (join room by HTTPS link) ----------------------------
// GET /join/:code - serves HTML page that redirects to the app deep link
app.get('/join/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const deepLink = `memkartiv2://join/${code}`;
  const html = `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Приєднатись до гри - МемКарти</title>
  <meta http-equiv="refresh" content="0;url=${deepLink}"/>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F9FAFB;text-align:center;padding:20px}
    .card{background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 12px rgba(0,0,0,.08);max-width:360px}
    h1{font-size:24px;margin:0 0 8px}
    .code{font-size:36px;font-weight:700;letter-spacing:4px;color:#2563EB;margin:16px 0}
    p{color:#6B7280;font-size:14px;line-height:1.5}
    a{display:inline-block;margin-top:16px;background:#2563EB;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600}
  </style>
</head>
<body>
  <div class="card">
    <h1>МемКарти 🃏</h1>
    <p>Тебе запросили до гри!</p>
    <div class="code">${code}</div>
    <p>Якщо додаток не відкрився автоматично:</p>
    <a href="${deepLink}">Відкрити МемКарти</a>
    <p style="margin-top:16px;font-size:12px;color:#9CA3AF">Немає додатку? Попроси друга надіслати APK або завантаж з GitHub.</p>
  </div>
  <script>window.location.href="${deepLink}";</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// --- QA: bad-meme flags (curation feedback from the app) --------------------
loadFlags();

app.post('/qa/flag', (req, res) => {
  const b = req.body ?? {};
  if (typeof b.memeId !== 'number') {
    return res.status(400).json({ error: 'memeId (number) is required' });
  }
  // From the review screen we don't want duplicate spam; in-game flags append.
  const fn = b.by === 'review' ? setFlagOnce : addFlag;
  const rec = fn({
    memeId: b.memeId,
    title: b.title,
    imageUrl: b.imageUrl,
    phase: b.phase,
    situation: b.situation,
    by: b.by,
  });
  res.json({ ok: true, flag: rec });
});

// Un-mark a meme (review screen toggle off): removes all its flags.
app.post('/qa/unflag', (req, res) => {
  const b = req.body ?? {};
  if (typeof b.memeId !== 'number') {
    return res.status(400).json({ error: 'memeId (number) is required' });
  }
  const removed = removeFlags(b.memeId);
  res.json({ ok: true, removed });
});

// Just the distinct flagged meme ids — used by the review screen to pre-mark.
app.get('/qa/flagged-ids', (_req, res) => {
  res.json({ ids: flaggedIds() });
});

// Review collected flags as JSON (count + per-meme summary + raw list).
app.get('/qa/flags', (_req, res) => {
  res.json({ count: allFlags().length, summary: summary(), flags: allFlags() });
});

// Download collected flags as CSV.
app.get('/qa/flags.csv', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bad-memes.csv"');
  res.send(toCsv());
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 10000,
  pingTimeout: 20000,
});

// ----------------------------------------------------------------------------
// Broadcast helpers
// ----------------------------------------------------------------------------

// Send each online member their personal view + the lobby player list.
function broadcast(room: Room): void {
  const players = manager.playersInfo(room);
  for (const member of room.members.values()) {
    if (!member.socketId) continue;
    io.to(member.socketId).emit('gameState', {
      roomCode: room.code,
      view: manager.viewFor(room, member.playerId),
      players,
      isHost: member.playerId === room.hostId,
    });
  }
  // Lobby-facing member list (online/ready/score) for any UI that wants it.
  io.to(room.code).emit('roomUpdated', { roomCode: room.code, players });
  syncPhaseTimer(room);
  scheduleBots(room);
}

// If the room has bots and someone still hasn't acted in pick/vote, make the
// bots take their turn after a short, human-like delay. This re-broadcasts,
// which re-evaluates and naturally chains pick -> vote -> reveal.
const BOT_DELAY_MS = 1200;

function scheduleBots(room: Room): void {
  const phase = room.state.phase;
  if (phase !== 'pick' && phase !== 'vote') return;
  const bots = room.state.players.filter((p) => p.id.startsWith('bot'));
  if (bots.length === 0) return;
  const pending = bots.some((p) =>
    phase === 'pick'
      ? !room.state.submissions.some((s) => s.playerId === p.id)
      : !room.state.votes[p.id],
  );
  if (!pending) return;
  if (room.botTimer) return; // already scheduled
  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    if (room.state.phase === 'pick') {
      room.state = botsSubmit(room.state);
    } else if (room.state.phase === 'vote') {
      room.state = botsVote(room.state);
    }
    broadcast(room);
  }, BOT_DELAY_MS);
}

// Schedule (or cancel) the auto-advance timer when the phase changes. Uses the
// per-room/per-round settings (pickSeconds / voteSeconds) from the engine state.
// A small grace buffer is added so genuine slow clients still beat the server.
const TIMER_GRACE_MS = 3000;

function syncPhaseTimer(room: Room): void {
  const { phase, round } = room.state;
  const key = `${phase}:${round}`;
  if (room.timerKey === key) return; // already scheduled for this phase
  if (room.phaseTimer) {
    clearTimeout(room.phaseTimer);
    room.phaseTimer = null;
  }
  room.timerKey = key;

  if (phase === 'pick') {
    const ms = room.state.pickSeconds * 1000 + TIMER_GRACE_MS;
    room.phaseTimer = setTimeout(() => {
      manager.autoAdvancePick(room);
      broadcast(room);
    }, ms);
  } else if (phase === 'vote') {
    const ms = room.state.voteSeconds * 1000 + TIMER_GRACE_MS;
    room.phaseTimer = setTimeout(() => {
      manager.autoAdvanceVote(room);
      broadcast(room);
    }, ms);
  }
}

function emitError(socket: Socket, message: string): void {
  socket.emit('errorMessage', { message });
}

// Register broadcast callback so deferred room timers (lobby grace, host transfer)
// can trigger broadcasts without a socket event.
manager.setOnBroadcast(broadcast);

// ----------------------------------------------------------------------------
// Socket.IO connection handling
// ----------------------------------------------------------------------------
io.on('connection', (socket: Socket) => {
  // Track which room this socket is in (for disconnect / leave).
  let joinedCode: string | null = null;

  socket.on('createRoom', (payload: { nickname?: string } = {}) => {
    const { code, playerId, room, token } = manager.createRoom(payload.nickname ?? '');
    joinedCode = code;
    socket.join(code);
    manager.attachSocket(code, playerId, socket.id);
    socket.emit('roomCreated', { roomCode: code, playerId, token });
    broadcast(room);
  });

  socket.on('joinRoom', (payload: { roomCode?: string; nickname?: string } = {}) => {
    const res = manager.joinRoom(payload.roomCode ?? '', payload.nickname ?? '');
    if (!res.ok) {
      emitError(socket, res.error);
      return;
    }
    joinedCode = res.room.code;
    socket.join(res.room.code);
    manager.attachSocket(res.room.code, res.playerId, socket.id);
    socket.emit('roomJoined', { roomCode: res.room.code, playerId: res.playerId, token: res.token });
    broadcast(res.room);
  });

  socket.on('rejoinRoom', (payload: { roomCode?: string; playerId?: string; token?: string } = {}) => {
    const code = payload.roomCode ?? '';
    const playerId = payload.playerId ?? '';
    const token = payload.token ?? '';
    if (!code || !playerId || !token) {
      emitError(socket, 'Невірні дані для перепідключення');
      return;
    }
    const res = manager.rejoinRoom(code, playerId, token, socket.id);
    if (!res.ok) {
      emitError(socket, res.error);
      return;
    }
    joinedCode = res.room.code;
    socket.join(res.room.code);
    socket.emit('roomRejoined', { roomCode: res.room.code, playerId });
    broadcast(res.room);
  });

  socket.on('leaveRoom', (payload: { roomCode?: string } = {}) => {
    const code = payload.roomCode ?? joinedCode;
    if (!code) return;
    socket.leave(code.toUpperCase());
    const room = manager.leaveRoom(code, socket.id);
    joinedCode = null;
    if (room) broadcast(room);
  });

  socket.on('playerReady', (payload: { roomCode?: string; ready?: boolean } = {}) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;
    manager.setReady(room, playerId, !!payload.ready);
    broadcast(room);
  });

  socket.on('startGame', (payload: { roomCode?: string } = {}) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;
    const ok = manager.hostAdvance(room, playerId);
    if (!ok) {
      emitError(socket, 'Не вдалось почати гру (потрібно щонайменше 2 гравці і права хоста)');
      return;
    }
    broadcast(room);
  });

  // Host advances from the reveal screen to the next round (or finish).
  socket.on('nextRound', (payload: { roomCode?: string } = {}) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;
    manager.hostAdvance(room, playerId);
    broadcast(room);
  });

  socket.on('playCard', (payload: { roomCode?: string; cardId?: number } = {}) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room || typeof payload.cardId !== 'number') return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;
    manager.playCard(room, playerId, payload.cardId);
    broadcast(room);
  });

  // Vote for a submission. Not in the original event draft, but the engine
  // separates pick/vote, so online needs it too (documented in README).
  socket.on('castVote', (payload: { roomCode?: string; submissionId?: string } = {}) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room || !payload.submissionId) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;
    manager.vote(room, playerId, payload.submissionId);
    broadcast(room);
  });

  // Replace a "bad" meme in hand with a fresh one (pick phase only). The engine
  // also posts a system chat message so everyone sees the swap.
  socket.on('replaceCard', (payload: { roomCode?: string; cardId?: number } = {}) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room || typeof payload.cardId !== 'number') return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;
    manager.replaceCard(room, playerId, payload.cardId);
    broadcast(room);
  });

  socket.on('updateSettings', (
    payload: { roomCode?: string; totalRounds?: number; pickSeconds?: number; voteSeconds?: number } = {},
  ) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (playerId !== room.hostId) return; // only host changes settings
    manager.applySettings(room, {
      totalRounds: payload.totalRounds,
      pickSeconds: payload.pickSeconds,
      voteSeconds: payload.voteSeconds,
    });
    broadcast(room);
  });

  socket.on('sendChatMessage', (payload: { roomCode?: string; text?: string } = {}) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room || !payload.text) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (!playerId) return;
    manager.chat(room, playerId, payload.text);
    broadcast(room);
  });

  // Host adds a bot to the lobby (online play vs bots / testing).
  socket.on('addBot', (payload: { roomCode?: string } = {}) => {
    const room = manager.getRoom(payload.roomCode ?? joinedCode);
    if (!room) return;
    const playerId = room.socketToPlayer.get(socket.id);
    if (playerId !== room.hostId) return; // only host can add bots
    const ok = manager.addBot(room);
    if (!ok) {
      emitError(socket, 'Не вдалось додати бота (кімната заповнена або гра вже почалась)');
      return;
    }
    broadcast(room);
  });

  socket.on('disconnect', () => {
    const res = manager.handleDisconnect(socket.id);
    if (res) broadcast(res.room);
  });
});

// Periodically reap empty rooms (>10 min fully offline).
setInterval(() => {
  const removed = manager.cleanupEmptyRooms();
  if (removed.length) {
    console.log(`[cleanup] removed ${removed.length} empty room(s): ${removed.join(', ')}`);
  }
}, 60 * 1000);

// Bind 0.0.0.0 so the server is reachable inside containers (Bunny/Docker),
// not just localhost.
server.listen(PORT, '0.0.0.0', () => {
  console.log(`MemKarti server listening on 0.0.0.0:${PORT}`);
});
