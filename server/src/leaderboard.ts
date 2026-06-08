// ============================================================================
// Leaderboard / friends tracker (JSON file on /data volume).
// ----------------------------------------------------------------------------
// Tracks which profiles have played together ("friends" relationship).
// Stored as /data/leaderboard.json: array of FriendPair objects.
// When a game ends, record all pairs of players who participated.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { getProfileById, type PlayerProfile } from './profiles';

const DATA_DIR = process.env.QA_DATA_DIR || path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'leaderboard.json');

export type FriendPair = {
  profileA: string;
  profileB: string;
  gamesTogether: number;
  lastPlayed: string;
};

let pairs: FriendPair[] = [];

function ensureDir(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}

function persist(): void {
  ensureDir();
  try {
    fs.writeFileSync(FILE, JSON.stringify(pairs, null, 2));
  } catch (e) {
    console.error('[leaderboard] failed to persist', e);
  }
}

export function loadLeaderboard(): void {
  ensureDir();
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    pairs = JSON.parse(raw) as FriendPair[];
  } catch {
    pairs = [];
  }
  console.log(`[leaderboard] loaded ${pairs.length} friend pair(s) from ${FILE}`);
}

/**
 * Normalize pair key so (A,B) and (B,A) are the same entry.
 */
function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/**
 * Record that a set of profile IDs played a game together.
 * Creates or updates FriendPair entries for all pairs.
 */
export function recordFriends(profileIds: string[]): void {
  const now = new Date().toISOString();
  for (let i = 0; i < profileIds.length; i++) {
    for (let j = i + 1; j < profileIds.length; j++) {
      const [a, b] = sortedPair(profileIds[i], profileIds[j]);
      const existing = pairs.find((p) => p.profileA === a && p.profileB === b);
      if (existing) {
        existing.gamesTogether += 1;
        existing.lastPlayed = now;
      } else {
        pairs.push({ profileA: a, profileB: b, gamesTogether: 1, lastPlayed: now });
      }
    }
  }
  persist();
}

export type LeaderboardEntry = {
  profileId: string;
  nickname: string;
  avatarSeed: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesTogether: number;
  lastPlayed: string;
};

/**
 * Get the friends leaderboard for a given profile.
 * Returns friends sorted by gamesWon desc.
 */
export function getFriendsLeaderboard(profileId: string): LeaderboardEntry[] {
  // Find all pairs involving this profile
  const relevant = pairs.filter((p) => p.profileA === profileId || p.profileB === profileId);

  const entries: LeaderboardEntry[] = [];
  for (const pair of relevant) {
    const friendId = pair.profileA === profileId ? pair.profileB : pair.profileA;
    const profile = getProfileById(friendId);
    if (!profile) continue;
    entries.push({
      profileId: friendId,
      nickname: profile.nickname,
      avatarSeed: profile.avatarSeed,
      gamesPlayed: profile.stats.gamesPlayed,
      gamesWon: profile.stats.gamesWon,
      gamesTogether: pair.gamesTogether,
      lastPlayed: pair.lastPlayed,
    });
  }

  // Sort by gamesWon descending
  entries.sort((a, b) => b.gamesWon - a.gamesWon);
  return entries;
}
