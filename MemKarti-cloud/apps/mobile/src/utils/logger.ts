// Lightweight logger that POSTs events to EXPO_PUBLIC_LOGS_ENDPOINT (if set).
// Falls back to console.log if endpoint not configured.
// Never throws — logging must not break the game.

const ENDPOINT = process.env.EXPO_PUBLIC_LOGS_ENDPOINT || '';

interface LogEntry {
  event: string;
  [key: string]: unknown;
}

export async function sendLog(entry: LogEntry): Promise<void> {
  const payload = { ...entry, ts: new Date().toISOString() };

  if (__DEV__) {
    console.log('[LOG]', JSON.stringify(payload));
  }

  if (!ENDPOINT) return;

  try {
    await fetch(`${ENDPOINT}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Silently ignore — logging must not break anything
  }
}

// Convenience wrappers
export const logGameStart = (room: string, mode: string, players: number) =>
  sendLog({ event: 'game_start', room, mode, players });

export const logRoundComplete = (room: string, round: number, winnerId: string) =>
  sendLog({ event: 'round_complete', room, round, winnerId });

export const logSubmit = (room: string, round: number, memeId: number) =>
  sendLog({ event: 'submit_meme', room, round, memeId });

export const logVote = (room: string, round: number) =>
  sendLog({ event: 'vote', room, round });

export const logError = (error: string, details?: unknown) =>
  sendLog({ event: 'error', error, details });

export const logAppOpen = () =>
  sendLog({ event: 'app_open' });
