// Sound effects module using expo-av.
// Sounds are muted by default until audio assets are provided.
// TODO: Add actual audio asset files to assets/sounds/ and update the soundMap below.
import { Audio } from 'expo-av';
import { loadSettings } from './settings';

export type SoundName = 'cardPick' | 'vote' | 'roundWin' | 'gameWin' | 'tick';

// TODO: Replace these placeholder URIs with actual bundled assets via require().
// Example: cardPick: require('../../assets/sounds/card-pick.mp3')
// For now the sound system is wired up but will silently skip if assets are missing.
const soundMap: Record<SoundName, string | null> = {
  cardPick: null,
  vote: null,
  roundWin: null,
  gameWin: null,
  tick: null,
};

const loadedSounds: Partial<Record<SoundName, Audio.Sound>> = {};

/** Pre-load sounds at app start (no-op until assets are added) */
export async function preloadSounds(): Promise<void> {
  for (const [name, uri] of Object.entries(soundMap)) {
    if (!uri) continue;
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      loadedSounds[name as SoundName] = sound;
    } catch {
      // silently skip
    }
  }
}

/** Play a named sound effect (respects user setting) */
export async function playSound(name: SoundName): Promise<void> {
  const settings = await loadSettings();
  if (!settings.soundEnabled) return;
  const sound = loadedSounds[name];
  if (!sound) return;
  try {
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    // best effort
  }
}

/** Unload all sounds (cleanup) */
export async function unloadSounds(): Promise<void> {
  for (const sound of Object.values(loadedSounds)) {
    try {
      await sound?.unloadAsync();
    } catch {
      // ignore
    }
  }
}
