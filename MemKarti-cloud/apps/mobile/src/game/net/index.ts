// ============================================================================
// GAMECLIENT — єдиний інтерфейс для екранів гри.
// ----------------------------------------------------------------------------
// Екрани (лобі, гра) працюють ТІЛЬКИ з цим інтерфейсом і не знають,
// чи це локальна Wi-Fi-гра, чи онлайн. Різниця — лише у фабриці клієнта.
// ============================================================================

import type { ClientView } from "../engine/engine"
import type { ClientAction } from "./protocol"

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected"

export interface GameClient {
	// Підключитися і увійти в гру під ніком.
	connect(nickname: string): Promise<void>
	// Надіслати ігрову дію (submit/judge/vote/start/...).
	send(action: ClientAction): void
	// Підписка на оновлення персонального виду стану.
	onState(cb: (view: ClientView) => void): void
	// Помилки (напр. «Ти вже обрав мем»).
	onError(cb: (message: string) => void): void
	// Стан зʼєднання (для індикатора «перепідключення…»).
	onConnectionState(cb: (state: ConnectionState) => void): void
	// Поточний playerId (після connect).
	readonly playerId: string | null
	disconnect(): void
}

// --- Типи режимів (для екрану вибору) -------------------------------
export type GameMode =
	| { kind: "online" } // гра через сервер
	| { kind: "wifi-host" } // цей телефон створює локальну гру
	| { kind: "wifi-join"; host: string; port?: number } // підключитися до хоста по IP

// Фабрики лежать у окремих файлах, щоб не тягнути нативні модулі туди, де вони не потрібні:
//   import { createOnlineClient } from "./online"
//   import { createOfflineHostClient, createOfflineJoinClient } from "./offline"
//
// Приклад використання на екрані:
//   const client = createClientForMode(mode)
//   client.onState(setView)
//   await client.connect(nickname)
//   client.send({ type: "submit", memeCardId })

export type { ClientAction } from "./protocol"
export type { ClientView } from "../engine/engine"

// ----------------------------------------------------------------------------
// ФАБРИКА КЛІЄНТА ЗА РЕЖИМОМ.
// Екрани викликають лише це; внутрішнє — online або Wi-Fi.
// ----------------------------------------------------------------------------
//
// Приклад:
//   const { client } = await createClientForMode({ kind: "wifi-host" })
//   client.onState(setView); await client.connect(nickname)
//
// Для wifi-host також повертається host (щоб показати QR і зупинити сервер).
export type ClientForMode = {
	client: GameClient
	// Присутній лише для wifi-host: викликати stop() при виході.
	stopHost?: () => void
	// IP+порт хоста для QR (лише wifi-host).
	hostAddress?: { ip: string | null; port: number }
}

export async function createClientForMode(
	mode: GameMode,
	opts: { onlineCreate?: boolean; roomCode?: string } = {},
): Promise<ClientForMode> {
	if (mode.kind === "online") {
		const { OnlineClient } = await import("./online")
		const client = opts.onlineCreate
			? new OnlineClient({ kind: "create" })
			: new OnlineClient({ kind: "join", roomCode: opts.roomCode || "" })
		return { client }
	}

	if (mode.kind === "wifi-host") {
		const { LanServerLink, getLocalIp } = await import("./lanLink")
		const { OfflineHost, OfflineClient } = await import("./offline")
		const { InMemoryClientLink } = await import("./link")
		const { DEFAULT_PORT } = await import("./protocol")
		const server = new LanServerLink(DEFAULT_PORT)
		// 60с на хід: якщо хтось AFK або втратив Wi-Fi — хост доходить за нього, гра не зависає.
		const host = new OfflineHost(server, { turnTimeoutMs: 60000 })
		await host.start()
		const ip = await getLocalIp()
		// Хост також грає — його власний клієнт йде через локальний LAN-сокет.
		const { LanClientLink } = await import("./lanLink")
		const client = new OfflineClient(new LanClientLink("127.0.0.1", DEFAULT_PORT))
		return {
			client,
			stopHost: () => host.stop(),
			hostAddress: { ip, port: DEFAULT_PORT },
		}
	}

	// wifi-join
	const { LanClientLink, default: _ } = (await import("./lanLink")) as any
	const { OfflineClient } = await import("./offline")
	const { DEFAULT_PORT } = await import("./protocol")
	const client = new OfflineClient(new LanClientLink(mode.host, mode.port ?? DEFAULT_PORT))
	return { client }
}
