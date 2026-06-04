// ============================================================================
// OFFLINE / Wi-Fi хостинг — гра без сервера.
// ----------------------------------------------------------------------------
// ОДИН телефон = хост. Він тримає GameState і крутить движок (engine).
// Інші телефони підключаються по Wi-Fi (сокет) і шлють дії.
// Хост розсилає КОЖНОМУ гравцю його ПЕРСОНАЛЬНИЙ вид (viewFor) — так руки
// інших гравців та анонімність авторів залишаються прихованими на клієнтах.
// ============================================================================

import {
	applyAction,
	createGame,
	viewFor,
	type Action,
	type ClientView,
	type GameState,
} from "../engine/engine"
import {
	decodeLines,
	encode,
	toEngineAction,
	type ClientAction,
	type ClientMsg,
	type ServerMsg,
} from "./protocol"
import type {
	ClientLink,
	LinkConnection,
	ServerLink,
} from "./link"
import { InMemoryClientLink, InMemoryServerLink } from "./link"
import type { ConnectionState, GameClient } from "./index"

const DEFAULT_BOT_TICK_MS = 900

export type OfflineHostOptions = { rng?: () => number; botTickMs?: number; turnTimeoutMs?: number }

type HostConn = {
	conn: LinkConnection
	playerId: string | null
	resumeToken: string
	buffer: string
}

// ----------------------------------------------------------------------------
// OfflineHost — авторитетний власник стану гри.
// ----------------------------------------------------------------------------
export class OfflineHost {
	private state: GameState
	private conns = new Map<string, HostConn>() // ключ = conn.id
	private byPlayer = new Map<string, string>() // playerId -> conn.id
	private byToken = new Map<string, string>() // resumeToken -> playerId
	private botTimer: ReturnType<typeof setInterval> | null = null
	private tokenSeq = 1
	private botTickMs: number
	private turnTimeoutMs: number
	private turnDeadline = 0
	private timedPhase: string | null = null
	private timedRound = -1
	private turnTimer: ReturnType<typeof setInterval> | null = null

	constructor(private server: ServerLink, opts: OfflineHostOptions = {}) {
		this.state = createGame(opts.rng ?? Math.random)
		this.botTickMs = opts.botTickMs ?? DEFAULT_BOT_TICK_MS
		this.turnTimeoutMs = opts.turnTimeoutMs ?? 0
	}

	get code(): string {
		return this.state.code
	}

	async start() {
		this.server.onConnection((conn) => this.handleConnection(conn))
		await this.server.start()
		if (this.botTickMs > 0) {
			this.botTimer = setInterval(() => this.tickBots(), this.botTickMs)
		}
		if (this.turnTimeoutMs > 0) {
			this.turnTimer = setInterval(() => this.maybeTimeout(), 1000)
		}
	}

	stop() {
		if (this.botTimer) clearInterval(this.botTimer)
		this.botTimer = null
		if (this.turnTimer) clearInterval(this.turnTimer)
		this.turnTimer = null
		for (const c of this.conns.values()) c.conn.close()
		this.conns.clear()
		this.server.stop()
	}

	private handleConnection(conn: LinkConnection) {
		const rec: HostConn = { conn, playerId: null, resumeToken: "", buffer: "" }
		this.conns.set(conn.id, rec)
		conn.onMessage((data) => {
			rec.buffer += data
			const { messages, rest } = decodeLines<ClientMsg>(rec.buffer)
			rec.buffer = rest
			for (const m of messages) this.onClientMsg(rec, m)
		})
		conn.onClose(() => {
			this.conns.delete(conn.id)
			if (rec.playerId) this.byPlayer.delete(rec.playerId)
			// Гравця НЕ видаляємо з гри — даємо шанс перепідключитися за resumeToken.
		})
	}

	private send(conn: LinkConnection, msg: ServerMsg) {
		conn.send(encode(msg))
	}

	private onClientMsg(rec: HostConn, msg: ClientMsg) {
		if (msg.t === "ping") {
			this.send(rec.conn, { t: "pong" })
			return
		}
		if (msg.t === "hello") {
			this.onHello(rec, msg)
			return
		}
		if (msg.t === "action") {
			if (!rec.playerId) {
				this.send(rec.conn, { t: "error", message: "Спочатку увійдіть у гру" })
				return
			}
			this.applyClientAction(rec.playerId, msg.action)
		}
	}

	private onHello(rec: HostConn, msg: Extract<ClientMsg, { t: "hello" }>) {
		// Спроба відновити сесію.
		if (msg.resumeToken && this.byToken.has(msg.resumeToken)) {
			const playerId = this.byToken.get(msg.resumeToken)!
			const player = this.state.players.find((p) => p.id === playerId)
			if (player) {
				rec.playerId = playerId
				rec.resumeToken = msg.resumeToken
				this.byPlayer.set(playerId, rec.conn.id)
				this.send(rec.conn, { t: "welcome", v: 1, playerId, resumeToken: msg.resumeToken })
				this.sendStateTo(rec)
				return
			}
		}
		// Новий гравець — join через движок. Перший, хто зайшов, стає хостом гри.
		const asHost = this.state.players.length === 0
		const res = applyAction(this.state, { type: "join", nickname: msg.nickname, asHost })
		if (res.error || !res.assignedPlayerId) {
			this.send(rec.conn, { t: "error", message: res.error || "Не вдалося увійти" })
			return
		}
		this.state = res.state
		const playerId = res.assignedPlayerId
		const token = "t" + this.tokenSeq++ + "_" + playerId
		rec.playerId = playerId
		rec.resumeToken = token
		this.byPlayer.set(playerId, rec.conn.id)
		this.byToken.set(token, playerId)
		this.send(rec.conn, { t: "welcome", v: 1, playerId, resumeToken: token })
		this.broadcast()
	}

	private applyClientAction(playerId: string, ca: ClientAction) {
		const action: Action = toEngineAction(playerId, ca)
		const res = applyAction(this.state, action)
		if (res.error) {
			const connId = this.byPlayer.get(playerId)
			const rec = connId ? this.conns.get(connId) : undefined
			if (rec) this.send(rec.conn, { t: "error", message: res.error })
			return
		}
		this.state = res.state
		this.broadcast()
	}

	// Ручний тік ботів — для тестів (коли botTickMs = 0).
	forceBotTick() {
		this.tickBots()
	}

	// Автоматичні ходи ботів (botTick обробляє всіх ботів за один виклик).
	private tickBots() {
		if (this.state.phase === "lobby" || this.state.phase === "finished") return
		const res = applyAction(this.state, { type: "botTick" })
		if (!res.error && res.state.seq !== this.state.seq) {
			this.state = res.state
			this.broadcast()
		}
	}

	// Ручний тригер тайм-ауту ходу — для тестів.
	forceTurnTimeout() {
		this.autoActStalled()
	}

	// Дедлайн ходу: якщо час вийшов — автоматично доходимо за тих, хто не встиг
	// (випадковий мем / суддя / голос), щоб гра не зависала через AFK-гравця.
	private maybeTimeout() {
		const phase = this.state.phase
		if (phase !== "playing" && phase !== "judging") {
			this.turnDeadline = 0
			this.timedPhase = phase
			this.timedRound = this.state.round
			return
		}
		if (phase !== this.timedPhase || this.state.round !== this.timedRound) {
			this.timedPhase = phase
			this.timedRound = this.state.round
			this.turnDeadline = Date.now() + this.turnTimeoutMs
			return
		}
		if (this.turnDeadline === 0 || Date.now() < this.turnDeadline) return
		this.autoActStalled()
	}

	private autoActStalled() {
		const phase = this.state.phase
		let changed = false
		const apply = (action: Action) => {
			const res = applyAction(this.state, action)
			if (!res.error) {
				this.state = res.state
				changed = true
			}
		}
		if (phase === "playing") {
			for (const p of this.state.players) {
				if (p.isBot || !p.isActive) continue
				const view = viewFor(this.state, p.id)
				if (view.isJudge || view.hasSubmitted) continue
				const card = view.myHand[0]
				if (card) apply({ type: "submit", playerId: p.id, memeCardId: card.id })
			}
		} else if (phase === "judging") {
			if (this.state.mode === "judge") {
				const judgeId = this.state.currentJudgeId
				if (judgeId) {
					const jview = viewFor(this.state, judgeId)
					const pick = jview.submissions[0]
					if (pick) apply({ type: "judge", playerId: judgeId, submissionId: pick.id })
				}
			} else {
				for (const p of this.state.players) {
					if (p.isBot || !p.isActive) continue
					const view = viewFor(this.state, p.id)
					if (view.hasVoted) continue
					const pick = view.submissions.find((s) => !s.isMine)
					if (pick) apply({ type: "vote", playerId: p.id, submissionId: pick.id })
				}
			}
		}
		this.turnDeadline = Date.now() + this.turnTimeoutMs
		if (changed) this.broadcast()
	}

	private sendStateTo(rec: HostConn) {
		if (!rec.playerId) return
		const view: ClientView = viewFor(this.state, rec.playerId)
		this.send(rec.conn, { t: "state", view })
	}

	private broadcast() {
		for (const rec of this.conns.values()) {
			if (rec.playerId) this.sendStateTo(rec)
		}
	}
}

// ----------------------------------------------------------------------------
// OfflineClient — клієнт поверх ClientLink (реалізує єдиний GameClient).
// Працює і для власного хоста (loopback), і для віддалених гравців.
// ----------------------------------------------------------------------------
export class OfflineClient implements GameClient {
	private conn: LinkConnection | null = null
	private buffer = ""
	private _playerId: string | null = null
	private resumeToken: string | null = null
	private nickname = ""
	private stateCb: ((v: ClientView) => void) | null = null
	private errorCb: ((m: string) => void) | null = null
	private connCb: ((s: ConnectionState) => void) | null = null
	private manuallyClosed = false
	private reconnectAttempts = 0

	constructor(private link: ClientLink) {}

	get playerId() {
		return this._playerId
	}

	async connect(nickname: string) {
		this.nickname = nickname
		this.manuallyClosed = false
		this.connCb?.("connecting")
		await this.openConnection()
	}

	private async openConnection() {
		const conn = await this.link.connect()
		this.conn = conn
		this.buffer = ""
		conn.onMessage((data) => {
			this.buffer += data
			const { messages, rest } = decodeLines<ServerMsg>(this.buffer)
			this.buffer = rest
			for (const m of messages) this.onServerMsg(m)
		})
		conn.onClose(() => this.onConnClosed())
		// Привітання (з токеном — якщо це перепідключення).
		const hello: ClientMsg = {
			t: "hello",
			v: 1,
			nickname: this.nickname,
			...(this.resumeToken ? { resumeToken: this.resumeToken } : {}),
		}
		conn.send(encode(hello))
	}

	private onServerMsg(msg: ServerMsg) {
		switch (msg.t) {
			case "welcome":
				this._playerId = msg.playerId
				this.resumeToken = msg.resumeToken
				this.reconnectAttempts = 0
				this.connCb?.("connected")
				break
			case "state":
				this.stateCb?.(msg.view)
				break
			case "error":
				this.errorCb?.(msg.message)
				break
			case "pong":
				break
		}
	}

	private onConnClosed() {
		if (this.manuallyClosed) {
			this.connCb?.("disconnected")
			return
		}
		// Авто-перепідключення з backoff (для обривів Wi-Fi).
		this.connCb?.("reconnecting")
		const delay = Math.min(500 * 2 ** this.reconnectAttempts, 8000)
		this.reconnectAttempts++
		setTimeout(() => {
			if (!this.manuallyClosed) this.openConnection().catch(() => this.onConnClosed())
		}, delay)
	}

	send(action: ClientAction) {
		if (!this.conn) return
		const msg: ClientMsg = { t: "action", action }
		this.conn.send(encode(msg))
	}

	onState(cb: (v: ClientView) => void) {
		this.stateCb = cb
	}
	onError(cb: (m: string) => void) {
		this.errorCb = cb
	}
	onConnectionState(cb: (s: ConnectionState) => void) {
		this.connCb = cb
	}

	disconnect() {
		this.manuallyClosed = true
		this.link.close()
		this.conn?.close()
		this.conn = null
	}
}

// ----------------------------------------------------------------------------
// ФАБРИКИ для тестів (in-memory). Реальні TCP/WS фабрики — у lanLink.ts.
// ----------------------------------------------------------------------------
export function createInMemoryHost(opts: OfflineHostOptions = {}): {
	host: OfflineHost
	server: InMemoryServerLink
} {
	const server = new InMemoryServerLink()
	const host = new OfflineHost(server, opts)
	return { host, server }
}

export function createInMemoryClient(server: InMemoryServerLink): OfflineClient {
	return new OfflineClient(new InMemoryClientLink(server))
}
