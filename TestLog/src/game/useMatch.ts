// Єдиний хук матчу: боти (in-memory), Wi-Fi хост, Wi-Fi приєднання.
// Екрани викликають його ОДИН раз із вказаною роллю — без умовних хуків.
//
// Wi-Fi хост: відкриває TCP-сервер (LanServerLink) + локальний клієнт
//   підключається до 127.0.0.1, тож хост теж грає як гравець.
// Wi-Fi join: лише клієнт підключається до IP хоста.
// Боти: in-memory хост+клієнт в одному процесі (нативні модулі не чіпаються).
import { useCallback, useEffect, useRef, useState } from 'react';
import { createInMemoryHost, createInMemoryClient, OfflineClient, OfflineHost } from './net/offline';
import { DEFAULT_PORT } from './net/protocol';
import type { ClientView } from './engine/engine';
import type { ClientAction } from './net/protocol';
import type { ConnectionState } from './net/index';

export type MatchRole =
  | { mode: 'bots' }
  | { mode: 'wifi-host' }
  | { mode: 'wifi-join'; host: string };

export type Match = {
  view: ClientView | null;
  error: string | null;
  send: (action: ClientAction) => void;
  ready: boolean;
  conn: ConnectionState | 'idle';
  hostIp: string | null; // показуємо другу (тільки для wifi-host)
  isHost: boolean;
  fatal: string | null; // фатальна помилка налаштування (немає модуля / не зміг підключитись)
};

export function useMatch(nickname: string, role: MatchRole): Match {
  const [view, setView] = useState<ClientView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [conn, setConn] = useState<ConnectionState | 'idle'>('idle');
  const [hostIp, setHostIp] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const clientRef = useRef<OfflineClient | null>(null);

  const isHost = role.mode !== 'wifi-join';

  useEffect(() => {
    let cancelled = false;
    let host: OfflineHost | null = null;
    let client: OfflineClient | null = null;

    const wire = (c: OfflineClient) => {
      clientRef.current = c;
      c.onState((v) => {
        if (!cancelled) setView(v);
      });
      c.onError((m) => {
        if (!cancelled) setError(m);
      });
      c.onConnectionState((s) => {
        if (!cancelled) setConn(s);
      });
    };

    (async () => {
      try {
        if (role.mode === 'bots') {
          const created = createInMemoryHost({ botTickMs: 700, turnTimeoutMs: 60000, resultsDelayMs: 4000 });
          host = created.host;
          client = createInMemoryClient(created.server);
          wire(client);
          await host.start();
          await client.connect(nickname || 'Гравець');
        } else if (role.mode === 'wifi-host') {
          // Лінивий import нативного транспорту — лише коли реально потрібен.
          const { LanServerLink, LanClientLink, getLocalIp } = require('./net/lanLink');
          const server = new LanServerLink(DEFAULT_PORT);
          host = new OfflineHost(server, { botTickMs: 700, turnTimeoutMs: 90000, resultsDelayMs: 4000 });
          await host.start();
          const ip = await getLocalIp();
          if (!cancelled) setHostIp(ip);
          // Хост теж грає: локальний клієнт через loopback.
          client = new OfflineClient(new LanClientLink('127.0.0.1', DEFAULT_PORT));
          wire(client);
          await client.connect(nickname || 'Хост');
        } else {
          const { LanClientLink } = require('./net/lanLink');
          client = new OfflineClient(new LanClientLink(role.host, DEFAULT_PORT));
          wire(client);
          await client.connect(nickname || 'Гравець');
        }
        if (!cancelled) setReady(true);
      } catch (e: any) {
        if (!cancelled) setFatal(e?.message ? String(e.message) : String(e));
      }
    })();

    return () => {
      cancelled = true;
      try {
        client?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        host?.stop();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback((action: ClientAction) => {
    setError(null);
    clientRef.current?.send(action);
  }, []);

  return { view, error, send, ready, conn, hostIp, isHost, fatal };
}
