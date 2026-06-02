// ============================================================================
// СИМУЛЯЦІЯ повної партії на ЧИСТОМУ двигуні (без мережі, без RN, без БД).
// Запуск:  npx tsx engine.sim.ts
// Це доказ, що правила гри працюють локально та детерміновано.
// ============================================================================

import {
	applyAction,
	createGame,
	viewFor,
	mulberry32,
	type Action,
	type GameState,
	type Mode,
} from "./engine"

let failures = 0
function assert(cond: boolean, msg: string) {
	if (!cond) {
		failures++
		console.error("  ❌ FAIL:", msg)
	} else {
		console.log("  ✅", msg)
	}
}

// Прокручує всі дії ботів, доки вони можуть ходити (емуляція таймерних botTick).
function drainBots(state: GameState, rng: () => number): GameState {
	let s = state
	for (let i = 0; i < 200; i++) {
		const r = applyAction(s, { type: "botTick" }, rng)
		if (r.state === s) break // нічого не змінилось
		s = r.state
	}
	return s
}

function step(s: GameState, action: Action, rng: () => number): GameState {
	const r = applyAction(s, action, rng)
	if (r.error) console.log("     (відхилено:", action.type, "→", r.error + ")")
	return r.state
}

function runMatch(mode: Mode, humanCount: number, botCount: number, seed: number) {
	console.log(`\n=== Партія: режим=${mode}, людей=${humanCount}, ботів=${botCount}, seed=${seed} ===`)
	const rng = mulberry32(seed)
	let s = createGame(rng)

	// 1) Хост + люди заходять
	const humanIds: string[] = []
	for (let i = 0; i < humanCount; i++) {
		const r = applyAction(s, { type: "join", nickname: `Гравець${i + 1}`, asHost: i === 0 }, rng)
		s = r.state
		humanIds.push(r.assignedPlayerId!)
	}
	const hostId = humanIds[0]
	assert(s.hostPlayerId === hostId, "хост призначений першому гравцю")

	// 2) Налаштування + боти
	s = step(s, { type: "settings", playerId: hostId, mode, targetScore: 3 }, rng)
	assert(s.mode === mode, `режим встановлено: ${mode}`)
	for (let i = 0; i < botCount; i++) s = step(s, { type: "addBot" }, rng)
	assert(s.players.filter((p) => p.isBot).length === botCount, `додано ботів: ${botCount}`)

	// 3) Старт
	s = step(s, { type: "start", playerId: hostId }, rng)
	assert(s.phase === "playing", "гра стартувала (playing)")
	assert(s.currentSituationId !== null, "обрана ситуація")
	for (const p of s.players) assert(p.hand.length === 8, `рука ${p.nickname} = 8 карт`)
	// Спільна колода: на старті роздано N*8 карт зі спільного пулу.
	const dealt = s.players.length * 8
	assert(s.deck.length === Math.max(0, 50 - dealt), `спільна колода зменшилась на ${dealt} карт`)

	// 4) Граємо раунди, доки не finished (з лімітом на безпеку)
	let guard = 0
	while (s.phase !== "finished" && guard++ < 100) {
		// люди-неботи здають мем (крім судді)
		if (s.phase === "playing") {
			for (const id of humanIds) {
				const me = viewFor(s, id)
				if (me.isJudge) continue
				if (me.hasSubmitted) continue
				if (me.myHand.length === 0) continue
				s = step(s, { type: "submit", playerId: id, memeCardId: me.myHand[0].id }, rng)
			}
			s = drainBots(s, rng)
		}

		// фаза суддівства / голосування
		if (s.phase === "judging") {
			if (mode === "judge") {
				const judgeId = s.currentJudgeId!
				const judgeView = viewFor(s, judgeId)
				const judgeIsBot = s.players.find((p) => p.id === judgeId)?.isBot
				if (!judgeIsBot && judgeView.submissions.length > 0) {
					s = step(s, { type: "judge", playerId: judgeId, submissionId: judgeView.submissions[0].id }, rng)
				}
				s = drainBots(s, rng)
			} else {
				for (const id of humanIds) {
					const me = viewFor(s, id)
					if (me.hasVoted) continue
					const other = me.submissions.find((sub) => !sub.isMine)
					if (other) s = step(s, { type: "vote", playerId: id, submissionId: other.id }, rng)
				}
				s = drainBots(s, rng)
			}
		}

		// анонімність: у фазах playing/judging автори прихов��ні
		if (s.phase === "playing" || s.phase === "judging") {
			const anyView = viewFor(s, humanIds[0])
			const leaked = anyView.submissions.some((sub) => !sub.isMine && sub.nickname !== null)
			assert(!leaked, `раунд ${s.round}: автори мемів приховані до результатів`)
		}

		// перехід до наступного раунду
		if (s.phase === "results") {
			const hadWinner = s.submissions.some((x) => x.isWinner)
			assert(hadWinner, `раунд ${s.round}: визначено переможця раунду`)
			s = step(s, { type: "nextRound", playerId: hostId }, rng)
		}
	}

	assert(s.phase === "finished", "гра завершилась (finished)")
	const champ = [...s.players].sort((a, b) => b.score - a.score)[0]
	assert(champ.score >= s.targetScore, `чемпіон набрав ${champ.score} ≥ ${s.targetScore}`)
	console.log(`   🏆 Переможець: ${champ.nickname} (${champ.score} очк.), раундів зіграно: ${s.round}`)
}

console.log("================ МемКарти: симуляція двигуна ================")
runMatch("judge", 1, 3, 12345) // 1 людина + 3 боти, режим судді
runMatch("vote", 2, 2, 777) // 2 людини + 2 боти, режим голосування
runMatch("judge", 1, 5, 999) // хост + 5 ботів — максимальна кімната
runMatch("vote", 1, 3, 555) // людина + боти, голосування

console.log("\n============================================================")
if (failures === 0) {
	console.log("✅ ВСІ ПЕРЕВІРКИ ПРОЙДЕНІ — двигун працює без мережі та БД.")
	process.exit(0)
} else {
	console.error(`❌ Провалено перевірок: ${failures}`)
	process.exit(1)
}
