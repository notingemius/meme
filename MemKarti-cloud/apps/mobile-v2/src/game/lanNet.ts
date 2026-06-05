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
