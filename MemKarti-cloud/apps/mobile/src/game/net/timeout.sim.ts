// Тест тайм-ауту ходу: якщо гравці AFK, хост має дойти за них і просунути гру.
import { mulberry32, type ClientView } from "../engine/engine"
import { createInMemoryHost, createInMemoryClient } from "./offline"

let failures = 0
function check(cond: boolean, label: string) {
	if (cond) console.log("  ✅ " + label)
	else {
		console.log("  ❌ FAIL: " + label)
		failures++
	}
}
const flush = () => new Promise((r) => setTimeout(r, 0))

async function run() {
	console.log("================ Тайм-аут ходу: симуляція ================")
	// botTickMs:0 і turnTimeoutMs:0 — керуємо вручну через forceTurnTimeout().
	const { host, server } = createInMemoryHost({ rng: mulberry32(7), botTickMs: 0, turnTimeoutMs: 0 })
	await host.start()

	const views = new Map<string, ClientView>()
	const mk = async (key: string, nick: string) => {
		const c = createInMemoryClient(server)
		c.onState((v) => views.set(key, v))
		await c.connect(nick)
		await flush()
		return c
	}

	const c1 = await mk("c1", "Павло")
	const c2 = await mk("c2", "Оля")
	const c3 = await mk("c3", "Макс")
	check((views.get("c1")?.players.length ?? 0) === 3, "3 гравці у лобі")

	c1.send({ type: "start" })
	await flush()
	check(views.get("c1")?.phase === "playing", "гра стартувала (playing)")

	// НІХТО з людей не субмітить (всі AFK). Тайм-аут має дойти за них.
	let guard = 0
	while (views.get("c1")?.phase === "playing" && guard++ < 20) {
		host.forceTurnTimeout()
		await flush()
	}
	const afterPlay = views.get("c1")?.phase
	check(afterPlay === "judging" || afterPlay === "results", "після тайм-ауту playing → просунулося (" + afterPlay + ")")

	// Продовжуємо форсувати тайм-аути та nextRound, поки гра не завершиться.
	guard = 0
	while (views.get("c1")?.phase !== "finished" && guard++ < 200) {
		const v = views.get("c1")!
		if (v.phase === "results") {
			c1.send({ type: "nextRound" })
		} else {
			host.forceTurnTimeout()
		}
		await flush()
	}
	const finalView = views.get("c1")!
	check(finalView.phase === "finished", "гра дійшла до finished лише через тайм-аути")
	const champ = finalView.players.find((p) => p.score >= finalView.targetScore)
	check(!!champ, "є чемпіон, який набрав цільовий рахунок")
	if (champ) console.log("   🏆 Переможець: " + champ.nickname + " (" + champ.score + " очк.)")

	console.log("\n============================================================")
	if (failures === 0) console.log("✅ ТАЙМ-АУТ ХОДУ ПРАЦЮЄ: хост доходить за AFK-гравців, гра не зависає.")
	else console.log("❌ ПРОВАЛЕНО: " + failures)
	host.stop()
	process.exit(failures === 0 ? 0 : 1)
}
run()
