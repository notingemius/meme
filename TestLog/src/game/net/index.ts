// ============================================================================
// GAMECLIENT — єдиний інтерфейс для екранів гри.
// ----------------------------------------------------------------------------
// Екрани (лобі, гра) працюють ТІЛЬКИ з цим інтерфейсом і не знають,
// чи це локальна Wi-Fi-гра, чи онлайн. Різниця — лише у фабриці клієнта.
//
// ПРИМІТКА (Фаза 3): онлайн (./online) і Wi-Fi (./lanLink) транспорти ще не
// перенесені — їх додамо у Фазі 4. Офлайн-гра з ботами працює напряму через
// createInMemoryHost/createInMemoryClient з ./offline і цю фабрику не потребує.
// ============================================================================

import type { ClientView } from "../engine/engine"
import type { ClientAction } from "./protocol"

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected"

export interface GameClient {
	connect(nickname: string): Promise<void>
	send(action: ClientAction): void
	onState(cb: (view: ClientView) => void): void
	onError(cb: (message: string) => void): void
	onConnectionState(cb: (state: ConnectionState) => void): void
	readonly playerId: string | null
	disconnect(): void
}

// --- Типи режимів (для екрану вибору) -------------------------------
export type GameMode =
	| { kind: "online" }
	| { kind: "wifi-host" }
	| { kind: "wifi-join"; host: string; port?: number }

export type { ClientAction } from "./protocol"
export type { ClientView } from "../engine/engine"
