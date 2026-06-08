// ============================================================================
// Player profiles + stats store (JSON file on /data volume).
// ----------------------------------------------------------------------------
// Each player is identified by a deviceId (UUID generated on first app launch).
// Profile data is persisted to /data/profiles.json as a JSON array.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.QA_DATA_DIR || path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'profiles.json');

export type PlayerStats = {
  gamesPlayed: number;
  gamesWon: number;
  roundsPlayed: number;
};

export type PlayerProfile = {
  id: string;
  deviceId: string;
  nickname: string;
  avatarSeed: string;
  stats: PlayerStats;
  createdAt: string;
  lastSeen: string;
};

let profiles: PlayerProfile[] = [];

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
    fs.writeFileSync(FILE, JSON.stringify(profiles, null, 2));
  } catch (e) {
    console.error('[profiles] failed to persist', e);
  }
}

export function loadProfiles(): void {
  ensureDir();
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    profiles = JSON.parse(raw) as PlayerProfile[];
  } catch {
    profiles = [];
  }
  console.log(`[profiles] loaded ${profiles.length} profile(s) from ${FILE}`);
}

// Generate a simple UUID v4 on the server side (for profile id).
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create a profile by deviceId.
 * If the device already has a profile, return it (with lastSeen updated).
 * Otherwise create a new one with a default nickname.
 */
export function getOrCreateProfile(deviceId: string, nickname?: string): PlayerProfile {
  let profile = profiles.find((p) => p.deviceId === deviceId);
  if (profile) {
    profile.lastSeen = new Date().toISOString();
    if (nickname && nickname.trim()) {
      profile.nickname = nickname.trim();
    }
    persist();
    return profile;
  }

  profile = {
    id: uuid(),
    deviceId,
    nickname: nickname?.trim() || 'Player',
    avatarSeed: deviceId,
    stats: { gamesPlayed: 0, gamesWon: 0, roundsPlayed: 0 },
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  };
  profiles.push(profile);
  persist();
  return profile;
}

/**
 * Get a profile by its profile id.
 */
export function getProfileById(id: string): PlayerProfile | undefined {
  return profiles.find((p) => p.id === id);
}

/**
 * Update nickname for a profile.
 */
export function updateNickname(id: string, nickname: string): PlayerProfile | undefined {
  const profile = profiles.find((p) => p.id === id);
  if (!profile) return undefined;
  profile.nickname = nickname.trim();
  profile.lastSeen = new Date().toISOString();
  persist();
  return profile;
}

/**
 * Record a game result for a profile.
 */
export function recordGameResult(id: string, won: boolean, roundsPlayed: number): PlayerProfile | undefined {
  const profile = profiles.find((p) => p.id === id);
  if (!profile) return undefined;
  profile.stats.gamesPlayed += 1;
  if (won) profile.stats.gamesWon += 1;
  profile.stats.roundsPlayed += roundsPlayed;
  profile.lastSeen = new Date().toISOString();
  persist();
  return profile;
}
