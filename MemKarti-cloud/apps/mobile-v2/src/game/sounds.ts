// Sound effects module — no-op stubs.
// Real expo-av будет добавлено позже с отдельным APK.
// Пока функции ничего не делают, чтобы не крашить приложение.

export type SoundName = 'cardPick' | 'vote' | 'roundWin' | 'gameWin' | 'join' | 'leave';

export async function playSound(_name: SoundName): Promise<void> {}
export async function preloadSounds(): Promise<void> {}
