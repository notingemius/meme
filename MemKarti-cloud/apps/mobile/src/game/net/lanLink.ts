// ============================================================================
// LAN LINK — реальний Wi-Fi транспорт поверх TCP-сокетів.
// ----------------------------------------------------------------------------
// Використовує native-модуль `react-native-tcp-socket`.
// ⚠️ Це NATIVE-модуль: працює ТІЛЬКИ у dev-build / production APK, НЕ в Expo Go.
// Встановлення:  yarn add react-native-tcp-socket
//
// Обидва телефони мають бути в ОДНІЙ Wi-Fi-мережі (або хотспот телефону-хоста).
// ============================================================================

import type { ClientLink, LinkConnection, ServerLink } from "./link"
import { DEFAULT_PORT } from "./protocol"

// Лінівий require, щоб не падати в Expo Go, де модуля немає.
function getTcp(): any {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		return require("react-native-tcp-socket").default
	} catch {
		throw new Error(
			"Режим «Рядом по Wi-Fi» потребує dev-build додатку (react-native-tcp-socket не працює в Expo Go).",
		)
	}
}

// Обгортка native-сокета під інтерфейс LinkConnection.
class TcpConnection implements LinkConnection {
	readonly id: string
	private msgCb: ((data: string) => void) | null = null
	private closeCb: (() => void) | null = null
	private closed = false

	constructor(id: string, private socket: any) {
		this.id = id
		socket.setEncoding("utf8")
		socket.on("data", (data: string | Buffer) => {
			this.msgCb?.(typeof data === "string" ? data : data.toString("utf8"))
		})
		socket.on("close", () => {
			if (this.closed) return
			this.closed = true
			this.closeCb?.()
		})
		socket.on("error", () => {
			if (this.closed) return
			this.closed = true
			this.closeCb?.()
		})
	}

	send(data: string) {
		if (this.closed) return
		try {
			this.socket.write(data)
		} catch {
			/* сокет вже закритий */
		}
	}
	close() {
		if (this.closed) return
		this.closed = true
		try {
			this.socket.destroy()
		} catch {
			/* ignore */
		}
	}
	onMessage(cb: (data: string) => void) {
		this.msgCb = cb
	}
	onClose(cb: () => void) {
		this.closeCb = cb
	}
}

// ----------------------------------------------------------------------------
// LanServerLink — хост відкриває TCP-сервер на DEFAULT_PORT.
// ----------------------------------------------------------------------------
export class LanServerLink implements ServerLink {
	private server: any = null
	private connCb: ((conn: LinkConnection) => void) | null = null
	private seq = 0

	constructor(private port: number = DEFAULT_PORT) {}

	start(): Promise<void> {
		const Tcp = getTcp()
		return new Promise((resolve, reject) => {
			this.server = Tcp.createServer((socket: any) => {
				const conn = new TcpConnection("lan" + this.seq++, socket)
				this.connCb?.(conn)
			})
			this.server.on("error", (e: Error) => reject(e))
			// 0.0.0.0 — слухати на всіх інтерфейсах (щоб інші телефони бачили).
			this.server.listen({ port: this.port, host: "0.0.0.0", reuseAddress: true }, () => resolve())
		})
	}
	stop() {
		try {
			this.server?.close()
		} catch {
			/* ignore */
		}
		this.server = null
	}
	onConnection(cb: (conn: LinkConnection) => void) {
		this.connCb = cb
	}
}

// ----------------------------------------------------------------------------
// LanClientLink — підключається до хоста за IP+порт.
// ----------------------------------------------------------------------------
export class LanClientLink implements ClientLink {
	private conn: TcpConnection | null = null

	constructor(private host: string, private port: number = DEFAULT_PORT) {}

	connect(): Promise<LinkConnection> {
		const Tcp = getTcp()
		return new Promise((resolve, reject) => {
			let settled = false
			const socket = Tcp.createConnection({ host: this.host, port: this.port }, () => {
				settled = true
				this.conn = new TcpConnection("lanc", socket)
				resolve(this.conn)
			})
			socket.on("error", (e: Error) => {
				if (!settled) reject(e)
			})
		})
	}
	close() {
		this.conn?.close()
	}
}

// Визначити локальну IP-адресу хоста (для QR / ручного вводу).
// Використовує expo-network (вже є в SDK).
export async function getLocalIp(): Promise<string | null> {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const Network = require("expo-network")
		const ip = await Network.getIpAddressAsync()
		return ip && ip !== "0.0.0.0" ? ip : null
	} catch {
		return null
	}
}
