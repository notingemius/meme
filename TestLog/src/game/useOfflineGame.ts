// Хук офлайн-игры против ботов (in-memory хост + клиент в одном процессе).
// Не тянет нативные модули — чистый TS, безопасно для standalone APK.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createInMemoryHost, createInMemoryClient } from './net/offline';
import type { OfflineClient } from './net/offline';
import type { ClientView } from './engine/engine';
import type { ClientAction } from './net/protocol';

export type OfflineGame = {
  view: ClientView | null;
  error: string | null;
  send: (action: ClientAction) => void;
  ready: boolean;
};

export function useOfflineGame(nickname: string): OfflineGame {
  const [view, setView] = useState<ClientView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const clientRef = useRef<OfflineClient | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { host, server } = createInMemoryHost({ botTickMs: 700, turnTimeoutMs: 60000, resultsDelayMs: 4000 });
    const client = createInMemoryClient(server);
    clientRef.current = client;

    client.onState((v) => {
      if (!cancelled) setView(v);
    });
    client.onError((m) => {
      if (!cancelled) setError(m);
    });

    (async () => {
      await host.start();
      await client.connect(nickname || 'Гравець');
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
      try {
        client.disconnect();
      } catch {
        // ignore
      }
      try {
        host.stop();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback((action: ClientAction) => {
    setError(null);
    clientRef.current?.send(action);
  }, []);

  return { view, error, send, ready };
}
