// ============================================================================
// LINK — абстракція каналу передачі (transport-agnostic).
// ----------------------------------------------------------------------------
// Будь-який транспорт (TCP/WebSocket/online) реалізує цей інтерфейс.
// Це дає одну та саму логіку OfflineHost/OfflineClient незалежно від мережі,
// і дозволяє тестувати все через InMemoryLink без реальних сокетів.
// ============================================================================

export type LinkStatus = "connecting" | "open" | "closed"

// Одне зʼєднання (з точки зору хоста — один клієнт; з точки зору клієнта — хост).
export interface LinkConnection {
	readonly id: string
	send(data: string): void
	close(): void
	onMessage(cb: (data: string) => void): void
	onClose(cb: () => void): void
}

// Серверна сторона (хост): приймає вхідні зʼєднання.
export interface ServerLink {
	start(): Promise<void>
	stop(): void
	onConnection(cb: (conn: LinkConnection) => void): void
}

// Клієнтська сторона: підключається до хоста.
export interface ClientLink {
	connect(): Promise<LinkConnection>
	close(): void
}

// ----------------------------------------------------------------------------
// IN-MEMORY LINK — для тестів та симуляції (без реальної мережі).
// Обидві сторони живуть у одному процесі і передають рядки через чергу мікрозавдань.
// ----------------------------------------------------------------------------
class InMemoryConnection implements LinkConnection {
	readonly id: string
	private msgCb: ((data: string) => void) | null = null
	private closeCb: (() => void) | null = null
	peer: InMemoryConnection | null = null
	private closed = false

	constructor(id: string) {
		this.id = id
	}

	send(data: string) {
		if (this.closed || !this.peer) return
		const peer = this.peer
		// Асинхронно, щоб імітувати мережу та розірвати рекурсію.
		Promise.resolve().then(() => {
			if (!peer.closed) peer.msgCb?.(data)
		})
	}

	close() {
		if (this.closed) return
		this.closed = true
		const peer = this.peer
		Promise.resolve().then(() => {
			this.closeCb?.()
			if (peer && !peer.closed) peer.close()
		})
	}

	onMessage(cb: (data: string) => void) {
		this.msgCb = cb
	}
	onClose(cb: () => void) {
		this.closeCb = cb
	}
}

export class InMemoryServerLink implements ServerLink {
	private connCb: ((conn: LinkConnection) => void) | null = null
	private seq = 0
	private running = false

	async start() {
		this.running = true
	}
	stop() {
		this.running = false
	}
	onConnection(cb: (conn: LinkConnection) => void) {
		this.connCb = cb
	}

	// Викликається InMemoryClientLink, щоб «підключитися». Повертає клієнтський кінець.
	accept(): LinkConnection {
		const hostSide = new InMemoryConnection("h" + this.seq)
		const clientSide = new InMemoryConnection("c" + this.seq)
		this.seq++
		hostSide.peer = clientSide
		clientSide.peer = hostSide
		if (this.running && this.connCb) this.connCb(hostSide)
		return clientSide
	}
}

export class InMemoryClientLink implements ClientLink {
	private conn: LinkConnection | null = null
	constructor(private server: InMemoryServerLink) {}

	async connect(): Promise<LinkConnection> {
		this.conn = this.server.accept()
		return this.conn
	}
	close() {
		this.conn?.close()
	}
}
