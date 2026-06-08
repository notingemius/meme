// ============================================================================
// Player profile client - manages local device identity + syncs with server.
// ----------------------------------------------------------------------------
// On first launch, generates a device UUID and stores it in AsyncStorage.
// Provides useProfile() hook that returns the profile state.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVER_URL } from '@/config';

const DEVICE_ID_KEY = '@memkarti:deviceId';
const PROFILE_CACHE_KEY = '@memkarti:profile';

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

// Simple UUID v4 generator
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create the device UUID (persisted in AsyncStorage).
 */
export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Sync profile with the server. Creates profile if not exists.
 */
export async function syncProfile(nickname?: string): Promise<PlayerProfile | null> {
  try {
    const deviceId = await getDeviceId();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${SERVER_URL}/api/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, nickname }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const profile: PlayerProfile = await res.json();

    // Cache locally
    await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    return profile;
  } catch {
    // Network error - try to return cached profile
    return getCachedProfile();
  }
}

/**
 * Get locally cached profile (offline fallback).
 */
export async function getCachedProfile(): Promise<PlayerProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlayerProfile;
  } catch {
    return null;
  }
}

/**
 * Update nickname on the server.
 */
export async function updateProfileNickname(profileId: string, nickname: string): Promise<PlayerProfile | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${SERVER_URL}/api/profiles/${profileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const profile: PlayerProfile = await res.json();
    await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    return profile;
  } catch {
    return null;
  }
}

/**
 * Report game result to the server.
 */
export async function reportGameResult(profileId: string, won: boolean, roundsPlayed: number): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    await fetch(`${SERVER_URL}/api/profiles/${profileId}/game-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ won, roundsPlayed }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch {
    // Silently fail - stats are best-effort
  }
}

/**
 * React hook for player profile.
 * Returns profile data, loading state, and a refresh function.
 */
export function useProfile() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (nickname?: string) => {
    setLoading(true);
    const p = await syncProfile(nickname);
    if (p) setProfile(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Load cached first for instant UI, then sync with server
    getCachedProfile().then((cached) => {
      if (cached) setProfile(cached);
      syncProfile().then((synced) => {
        if (synced) setProfile(synced);
        setLoading(false);
      });
    });
  }, []);

  return { profile, loading, refresh };
}
