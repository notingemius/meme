// ============================================================================
// LAN-сеть для Wi-Fi multiplayer.
// ----------------------------------------------------------------------------
// Использует react-native-tcp-socket (native module, требует dev/release build).
// Простой протокол: каждое сообщение = JSON + "\n" (line-delimited).
// ============================================================================

import TcpSocket from 'react-native-tcp-socket';

export const DEFAULT_PORT = 8787;

export type LineHandler = (line: string) => void;
export type CloseHandler = () => void;

// Подключение к одному пиру (двунаправленное).
export class Peer {
  private buffer = '';
  private msgCb: LineHandler | null = null;
  private closeCb: CloseHandler | null = null;
  private closed = false;

  constructor(public readonly id: string, private socket: any) {
    socket.setEncoding('utf8');
    socket.on('data', (data: string | Buffer) => {
      const text = typeof data === 'string' ? data : data.toString('utf8');
      this.buffer += text;
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (t && this.msgCb) this.msgCb(t);
      }
    });
    const onDie = () => {
      if (this.closed) return;
      this.closed = true;
      this.closeCb?.();
    };
    socket.on('close', onDie);
    socket.on('error', onDie);
  }

  send(obj: any) {
    if (this.closed) return;
    try {
      this.socket.write(JSON.stringify(obj) + '\n');
    } catch {
      /* socket closed */
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try {
      this.socket.destroy();
    } catch {
      /* ignore */
    }
  }

  onMessage(cb: LineHandler) {
    this.msgCb = cb;
  }
  onClose(cb: CloseHandler) {
    this.closeCb = cb;
  }
}

// ----------------------------------------------------------------------------
// Хост: открывает TCP-сервер. Принимает подключения.
// ----------------------------------------------------------------------------
export class LanHost {
  private server: any = null;
  private seq = 0;
  private peers: Peer[] = [];
  private onPeerCb: ((p: Peer) => void) | null = null;

  start(port: number = DEFAULT_PORT): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = TcpSocket.createServer((socket: any) => {
          const peer = new Peer('p' + this.seq++, socket);
          this.peers.push(peer);
          peer.onClose(() => {
            this.peers = this.peers.filter((p) => p !== peer);
          });
          this.onPeerCb?.(peer);
        });
        this.server.on('error', (e: Error) => reject(e));
        this.server.listen(
          { port, host: '0.0.0.0', reuseAddress: true },
          () => resolve(),
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  onPeerConnected(cb: (p: Peer) => void) {
    this.onPeerCb = cb;
  }

  broadcast(obj: any) {
    for (const p of this.peers) p.send(obj);
  }

  stop() {
    for (const p of this.peers) p.close();
    this.peers = [];
    try {
      this.server?.close();
    } catch {
      /* ignore */
    }
    this.server = null;
  }
}

// ----------------------------------------------------------------------------
// Клиент: подключается к хосту по IP+порт.
// ----------------------------------------------------------------------------
export class LanClient {
  private peer: Peer | null = null;

  connect(host: string, port: number = DEFAULT_PORT): Promise<Peer> {
    return new Promise((resolve, reject) => {
      let settled = false;
      try {
        const socket = TcpSocket.createConnection(
          { host, port } as any,
          () => {
            settled = true;
            this.peer = new Peer('c', socket);
            resolve(this.peer);
          },
        );
        socket.on('error', (e: Error) => {
          if (!settled) reject(e);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  close() {
    this.peer?.close();
  }
}

// Локальный IP — нужен хосту чтобы показать его игрокам.
export async function getLocalIp(): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Network = require('expo-network');
    const ip = await Network.getIpAddressAsync();
    return ip && ip !== '0.0.0.0' ? ip : null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Сканер подсети — найти хостов в LAN без ввода IP.
// ----------------------------------------------------------------------------
// Алгоритм:
//   1. Определить свой IP (например 192.168.1.42)
//   2. Параллельно попробовать TCP-connect к каждому IP в подсети на DEFAULT_PORT
//   3. Кто принял подключение — хост МемКарт
//   4. Если хост отправит сразу serverInfo — узнаем его ник; иначе показываем IP
// ----------------------------------------------------------------------------

export type FoundHost = {
  ip: string;
  nickname?: string;
  players?: number;
};

function tryProbe(ip: string, port: number, timeoutMs: number): Promise<FoundHost | null> {
  return new Promise((resolve) => {
    let settled = false;
    let socket: any = null;
    const finish = (val: FoundHost | null) => {
      if (settled) return;
      settled = true;
      try {
        socket?.destroy();
      } catch {
        /* ignore */
      }
      resolve(val);
    };

    try {
      socket = TcpSocket.createConnection({ host: ip, port } as any, () => {
        // Подключились — это хост. Слушаем serverInfo (если хост его шлёт).
        let buf = '';
        socket.setEncoding('utf8');
        socket.on('data', (d: string | Buffer) => {
          buf += typeof d === 'string' ? d : d.toString('utf8');
          const idx = buf.indexOf('\n');
          if (idx >= 0) {
            const line = buf.slice(0, idx).trim();
            try {
              const msg = JSON.parse(line);
              if (msg.t === 'serverInfo') {
                finish({ ip, nickname: msg.nickname, players: msg.players });
                return;
              }
            } catch {
              /* ignore */
            }
            finish({ ip });
          }
        });
        // Если хост не шлёт serverInfo за timeoutMs/2 — просто помечаем ip как доступный
        setTimeout(() => finish({ ip }), Math.max(300, timeoutMs / 2));
      });
      socket.on('error', () => finish(null));
      socket.on('timeout', () => finish(null));
      setTimeout(() => finish(null), timeoutMs);
    } catch {
      finish(null);
    }
  });
}

export async function scanSubnet(
  port: number = DEFAULT_PORT,
  onProgress?: (done: number, total: number) => void,
): Promise<FoundHost[]> {
  const myIp = await getLocalIp();
  if (!myIp) return [];
  const parts = myIp.split('.');
  if (parts.length !== 4) return [];
  const base = `${parts[0]}.${parts[1]}.${parts[2]}.`;

  const found: FoundHost[] = [];
  const BATCH = 32;
  const total = 254;
  let done = 0;

  for (let start = 1; start <= 254; start += BATCH) {
    const batch: Promise<FoundHost | null>[] = [];
    for (let i = start; i < Math.min(start + BATCH, 255); i++) {
      const ip = `${base}${i}`;
      if (ip === myIp) {
        done++;
        continue;
      }
      batch.push(tryProbe(ip, port, 800));
    }
    const results = await Promise.all(batch);
    for (const r of results) {
      if (r) found.push(r);
    }
    done = Math.min(done + BATCH, total);
    onProgress?.(done, total);
  }
  return found;
}
