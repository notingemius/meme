// ============================================================================
// СПІЛЬНИЙ ПРОТОКОЛ ПОВІДОМЛЕНЬ
// ----------------------------------------------------------------------------
// Цей формат однаковий для ОБОХ транспортів (Wi-Fi та онлайн).
// Гравець шле ClientMsg → хост; хост шле ServerMsg → гравцям.
// ============================================================================

import type { Action, ClientView, Lang, Mode } from "../engine/engine"

export const PROTOCOL_VERSION = 1
export const DEFAULT_PORT = 8787

// --- Гравець → хост -------------------------------------------------
export type ClientMsg =
	// Перше повідомлення після підключення. Якщо є resumeToken — спроба відновити сесію.
	| { t: "hello"; v: number; nickname: string; resumeToken?: string }
	// Будь-яка ігрова дія (окрім join — її робить hello).
	// playerId підставляє хост, тому тут Action без playerId.
	| { t: "action"; action: ClientAction }
	| { t: "ping" }

// Дії, які може надіслати клієнт (playerId додає хост з його зʼєднання).
export type ClientAction =
	| { type: "addBot" }
	| { type: "settings"; mode?: Mode; language?: Lang; targetScore?: number }
	| { type: "start" }
	| { type: "submit"; memeCardId: number }
	| { type: "judge"; submissionId: string }
	| { type: "vote"; submissionId: string }
	| { type: "nextRound" }
	| { type: "leave" }

// --- Хост → гравець -------------------------------------------------
export type ServerMsg =
	// Підтвердження підключення: призначений playerId + токен для відновлення.
	| { t: "welcome"; v: number; playerId: string; resumeToken: string }
	// Персональний вид стану гри (вже відфільтрований через viewFor).
	| { t: "state"; view: ClientView }
	// Помилка у відповідь на дію (напр. «Ти вже обрав мем»).
	| { t: "error"; message: string }
	| { t: "pong" }

// Перетворення ClientAction (без playerId) на повний engine Action.
export function toEngineAction(playerId: string, a: ClientAction): Action {
	switch (a.type) {
		case "addBot":
			return { type: "addBot" }
		case "settings":
			return { type: "settings", playerId, mode: a.mode, language: a.language, targetScore: a.targetScore }
		case "start":
			return { type: "start", playerId }
		case "submit":
			return { type: "submit", playerId, memeCardId: a.memeCardId }
		case "judge":
			return { type: "judge", playerId, submissionId: a.submissionId }
		case "vote":
			return { type: "vote", playerId, submissionId: a.submissionId }
		case "nextRound":
			return { type: "nextRound", playerId }
		case "leave":
			return { type: "leave", playerId }
	}
}

// Безпечне (de)серіалізування рядків лінії (одне повідомлення = один рядок JSON).
export function encode(msg: ClientMsg | ServerMsg): string {
	return JSON.stringify(msg) + "\n"
}

export function decodeLines<T>(buffer: string): { messages: T[]; rest: string } {
	const parts = buffer.split("\n")
	const rest = parts.pop() ?? ""
	const messages: T[] = []
	for (const line of parts) {
		const trimmed = line.trim()
		if (!trimmed) continue
		try {
			messages.push(JSON.parse(trimmed) as T)
		} catch {
			// ігноруємо битий рядок
		}
	}
	return { messages, rest }
}
