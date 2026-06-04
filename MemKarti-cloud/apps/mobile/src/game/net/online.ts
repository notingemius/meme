// ============================================================================
// ONLINE CLIENT — гра через сервер (REST API rooms/...).
// ----------------------------------------------------------------------------
// Реалізує той самий GameClient, що й OfflineClient — екрани не бачать різниці.
// Сервер — авторитет; клієнт періодично опитує /state і перетворює його на ClientView.
// Режим online використовує ті ж правила (серверні), що вже узгоджені з движком.
// ============================================================================

import type { ClientView } from "../engine/engine"
import type { ClientAction } from "./protocol"
import type { ConnectionState, GameClient } from "./index"

const POLL_MS = 1500

function baseUrl(): string {
	const u = process.env.EXPO_PUBLIC_BASE_URL || process.env.EXPO_PUBLIC_PROXY_BASE_URL || ""
	return u.replace(/\/$/, "")
}

// Перетворення відповіді /state (числові id) на ClientView (рядкові id як у движку).
function toView(data: any, myId: string): ClientView {
	const room = data.room
	const phaseMap: Record<string, ClientView["phase"]> = {
		lobby: "lobby",
		playing: "playing",
		judging: "judging",
		results: "results",
		finished: "finished",
	}
	const id = (n: any) => (n == null ? null : String(n))
	return {
		code: room.code,
		phase: phaseMap[room.status] ?? "lobby",
		mode: room.mode,
		language: room.language,
		targetScore: room.target_score,
		round: room.current_round,
		hostPlayerId: id(room.host_player_id),
		currentJudgeId: id(room.current_judge_id),
		situation: data.situation
			? { id: data.situation.id, text_ua: data.situation.text_ua, text_ru: data.situation.text_ru }
			: null,
		players: (data.players ?? []).map((p: any) => ({
			id: String(p.id),
			nickname: p.nickname,
			score: p.score,
			avatarColor: p.avatar_color,
			isActive: p.is_active,
			isBot: p.is_bot,
		})),
		myId,
		isHost: id(room.host_player_id) === myId,
		isJudge: id(room.current_judge_id) === myId,
		myHand: (data.hand ?? []).map((h: any) => ({
			id: h.meme_id,
			title: h.title,
			image_url: h.image_url,
		})),
		submissions: (data.submissions ?? []).map((s: any) => ({
			id: String(s.id),
			memeCardId: s.meme_card_id,
			image_url: s.image_url,
			title: s.title,
			votes: s.votes,
			isWinner: s.is_winner,
			isMine: s.is_my_submission,
			playerId: id(s.player_id),
			nickname: s.nickname ?? null,
			avatarColor: s.avatar_color ?? null,
		})),
		hasSubmitted: !!data.hasSubmitted,
		hasVoted: !!data.hasVoted,
		seq: 0,
	}
}

export type OnlineMode =
	| { kind: "create" }
	| { kind: "join"; roomCode: string }

export class OnlineClient implements GameClient {
	private _playerId: string | null = null
	private code: string | null = null
	private stateCb: ((v: ClientView) => void) | null = null
	private errorCb: ((m: string) => void) | null = null
	private connCb: ((s: ConnectionState) => void) | null = null
	private timer: ReturnType<typeof setInterval> | null = null
	private stopped = false
	private failStreak = 0

	constructor(private mode: OnlineMode) {}

	get playerId() {
		return this._playerId
	}

	private async api(path: string, init?: RequestInit): Promise<any> {
		const res = await fetch(baseUrl() + path, {
			...init,
			headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
		})
		const json = await res.json().catch(() => ({}))
		if (!res.ok) throw new Error(json?.error || `Помилка сервера (${res.status})`)
		return json
	}

	async connect(nickname: string) {
		this.connCb?.("connecting")
		try {
			if (this.mode.kind === "create") {
				const r = await this.api("/api/rooms/create", {
					method: "POST",
					body: JSON.stringify({ nickname }),
				})
				this.code = r.code ?? r.room?.code
				this._playerId = String(r.playerId ?? r.player?.id)
			} else {
				const r = await this.api("/api/rooms/join", {
					method: "POST",
					body: JSON.stringify({ nickname, roomCode: this.mode.roomCode }),
				})
				this.code = r.code ?? r.room?.code ?? this.mode.roomCode
				this._playerId = String(r.playerId ?? r.player?.id)
			}
			this.connCb?.("connected")
			this.startPolling()
		} catch (e: any) {
			this.errorCb?.(e?.message || "Не вдалося підключитися")
			this.connCb?.("disconnected")
			throw e
		}
	}

	private startPolling() {
		const poll = async () => {
			if (this.stopped || !this.code) return
			try {
				const data = await this.api(
					`/api/rooms/${this.code}/state?playerId=${this._playerId}`,
				)
				this.failStreak = 0
				this.connCb?.("connected")
				if (this._playerId) this.stateCb?.(toView(data, this._playerId))
				// Хост тригерить ходи ботів (сервер робить один хід за тік).
				if (data?.room?.host_player_id != null && String(data.room.host_player_id) === this._playerId) {
					this.api(`/api/rooms/${this.code}/bot-tick`, { method: "POST" }).catch(() => {})
				}
			} catch {
				this.failStreak++
				this.connCb?.(this.failStreak > 3 ? "disconnected" : "reconnecting")
			}
		}
		this.timer = setInterval(poll, POLL_MS)
		poll()
	}

	async send(action: ClientAction) {
		if (!this.code || !this._playerId) return
		const pid = this._playerId
		const base = `/api/rooms/${this.code}`
		try {
			switch (action.type) {
				case "addBot":
					await this.api(`${base}/add-bot`, { method: "POST", body: JSON.stringify({ playerId: pid }) })
					break
				case "settings":
					await this.api(`${base}/settings`, {
						method: "POST",
						body: JSON.stringify({ playerId: pid, mode: action.mode, language: action.language, targetScore: action.targetScore }),
					})
					break
				case "start":
					await this.api(`${base}/start`, { method: "POST", body: JSON.stringify({ playerId: pid }) })
					break
				case "submit":
					await this.api(`${base}/submit`, { method: "POST", body: JSON.stringify({ playerId: pid, memeCardId: action.memeCardId }) })
					break
				case "judge":
					await this.api(`${base}/judge`, { method: "POST", body: JSON.stringify({ playerId: pid, submissionId: Number(action.submissionId) }) })
					break
				case "vote":
					await this.api(`${base}/vote`, { method: "POST", body: JSON.stringify({ playerId: pid, submissionId: Number(action.submissionId) }) })
					break
				case "nextRound":
					await this.api(`${base}/next-round`, { method: "POST", body: JSON.stringify({ playerId: pid }) })
					break
				case "leave":
					await this.api(`${base}/leave`, { method: "POST", body: JSON.stringify({ playerId: pid }) })
					break
			}
		} catch (e: any) {
			this.errorCb?.(e?.message || "Дія не вдалася")
		}
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
		this.stopped = true
		if (this.timer) clearInterval(this.timer)
		this.timer = null
	}
}
