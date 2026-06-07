// ============================================================================
// МемКарти — ЧИСТИЙ ІГРОВИЙ ДВИГУН (transport-agnostic)
// ----------------------------------------------------------------------------
// Цей файл НЕ знає про мережу, БД чи React. Це чиста логіка гри:
//   state + action -> новий state.
// Той самий двигун використовується і в ОФЛАЙН (хост-телефон крутить його локально),
// і в ОНЛАЙН (та сама логіка, але на сервері). Завдяки цьому правила гри єдині.
// ============================================================================

import { SITUATIONS, MEME_CARDS, type MemeCard, type Situation } from "./deck"

export type Phase = "lobby" | "playing" | "judging" | "results" | "finished"
export type Mode = "judge" | "vote"
export type Lang = "ua" | "ru"

export const HAND_SIZE = 6
export const MAX_PLAYERS = 10

export const AVATAR_COLORS = [
	"#2563EB", "#EA580C", "#16A34A", "#DC2626", "#9333EA",
	"#0891B2", "#CA8A04", "#DB2777", "#65A30D", "#0284C7",
]
export const BOT_COLOR = "#6B7280"
const BOT_NAMES = ["МемБот 🤖", "АвтоГравець", "РобоМем", "БотЗнавець", "МемМашина", "Шарик-Бот", "Комедіант"]

// --- Детермінований RNG (для тестів) ------------------------------------
export type Rng = () => number
export function mulberry32(seed: number): Rng {
	let a = seed >>> 0
	return () => {
		a |= 0; a = (a + 0x6d2b79f5) | 0
		let t = Math.imul(a ^ (a >>> 15), 1 | a)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

export interface Player {
	id: string
	nickname: string
	score: number
	avatarColor: string
	isActive: boolean
	isBot: boolean
	hand: number[] // meme card ids
}

export interface Submission {
	id: string
	playerId: string
	memeCardId: number
	votes: number
	isWinner: boolean
}

export interface Vote {
	voterId: string
	submissionId: string
}

export interface GameState {
	code: string
	phase: Phase
	mode: Mode
	language: Lang
	targetScore: number
	round: number
	currentSituationId: number | null
	currentJudgeId: string | null
	hostPlayerId: string | null
	players: Player[]
	submissions: Submission[] // лише поточний раунд
	votes: Vote[] // лише поточний раунд
	usedSituationIds: number[]
	idSeq: number
	seq: number // бампається при кожній зміні (клієнти розуміють ”є новини”)
}

export type Action =
	| { type: "join"; nickname: string; asHost?: boolean }
	| { type: "addBot" }
	| { type: "leave"; playerId: string }
	| { type: "settings"; playerId: string; mode?: Mode; language?: Lang; targetScore?: number }
	| { type: "start"; playerId: string }
	| { type: "submit"; playerId: string; memeCardId: number }
	| { type: "judge"; playerId: string; submissionId: string }
	| { type: "vote"; playerId: string; submissionId: string }
	| { type: "nextRound"; playerId: string }
	| { type: "botTick" }

export interface ActionResult {
	state: GameState
	error?: string
	assignedPlayerId?: string // для join
}

// --- Створення нової гри -----------------------------------------------
export function createGame(rng: Rng = Math.random): GameState {
	return {
		code: genCode(rng),
		phase: "lobby",
		mode: "judge",
		language: "ua",
		targetScore: 5,
		round: 0,
		currentSituationId: null,
		currentJudgeId: null,
		hostPlayerId: null,
		players: [],
		submissions: [],
		votes: [],
		usedSituationIds: [],
		idSeq: 1,
		seq: 1,
	}
}

export function genCode(rng: Rng = Math.random): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	let code = ""
	for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(rng() * chars.length))
	return code
}

// ============================================================================
// ГОЛОВНА ФУНКЦІЯ: applyAction
// ============================================================================
export function applyAction(prev: GameState, action: Action, rng: Rng = Math.random): ActionResult {
	const s = clone(prev)
	const fail = (error: string): ActionResult => ({ state: prev, error })

	switch (action.type) {
		case "join": {
			if (s.phase !== "lobby") return fail("Гра вже почалась")
			if (s.players.length >= MAX_PLAYERS) return fail("Кімната повна")
			const nick = (action.nickname || "").trim()
			if (!nick) return fail("Нік обовʼязковий")
			const id = "p" + s.idSeq++
			const color = pickColor(s)
			s.players.push({ id, nickname: nick, score: 0, avatarColor: color, isActive: true, isBot: false, hand: [] })
			if (action.asHost || !s.hostPlayerId) s.hostPlayerId = id
			bump(s)
			return { state: s, assignedPlayerId: id }
		}

		case "addBot": {
			if (s.phase !== "lobby") return fail("Бота можна додати лише у лобі")
			if (s.players.length >= MAX_PLAYERS) return fail("Кімната повна")
			const usedNames = new Set(s.players.filter((p) => p.isBot).map((p) => p.nickname))
			const name = BOT_NAMES.find((n) => !usedNames.has(n)) || `Бот ${s.players.length + 1}`
			const id = "b" + s.idSeq++
			s.players.push({ id, nickname: name, score: 0, avatarColor: BOT_COLOR, isActive: true, isBot: true, hand: [] })
			bump(s)
			return { state: s }
		}

		case "leave": {
			const p = s.players.find((x) => x.id === action.playerId)
			if (!p) return { state: prev }
			p.isActive = false
			// Міграція хоста: якщо вийшов хост — призначити нового живого гравця
			if (s.hostPlayerId === action.playerId) {
				const next = s.players.find((x) => x.isActive && !x.isBot) || s.players.find((x) => x.isActive)
				s.hostPlayerId = next ? next.id : null
			}
			// Якщо вийшов суддя під час гри — передати суддівство
			if (s.phase !== "lobby" && s.mode === "judge" && s.currentJudgeId === action.playerId) {
				s.currentJudgeId = nextJudge(s, action.playerId)
			}
			maybeResolve(s, rng)
			bump(s)
			return { state: s }
		}

		case "settings": {
			if (s.hostPlayerId !== action.playerId) return fail("Тільки хост може змінювати")
			if (s.phase !== "lobby") return fail("Гра вже почалась")
			if (action.mode === "judge" || action.mode === "vote") s.mode = action.mode
			if (action.language === "ua" || action.language === "ru") s.language = action.language
			if (typeof action.targetScore === "number" && action.targetScore >= 3 && action.targetScore <= 15)
				s.targetScore = Math.round(action.targetScore)
			bump(s)
			return { state: s }
		}

		case "start": {
			if (s.hostPlayerId !== action.playerId) return fail("Тільки хост може почати")
			if (s.phase !== "lobby") return fail("Гра вже почалась")
			const active = activePlayers(s)
			const minPlayers = s.mode === "judge" ? 3 : 2
			if (active.length < minPlayers)
				return fail(s.mode === "judge" ? "Для режиму суддя потрібно 3+ гравці" : "Потрібно мінімум 2 гравці")
			for (const p of active) dealCards(s, p, HAND_SIZE, rng)
			s.round = 1
			s.submissions = []
			s.votes = []
			s.currentSituationId = pickSituation(s, rng)
			s.currentJudgeId = s.mode === "judge" ? nextJudge(s, null) : null
			s.phase = "playing"
			bump(s)
			return { state: s }
		}

		case "submit": {
			if (s.phase !== "playing") return fail("Зараз не час обирати")
			const p = s.players.find((x) => x.id === action.playerId)
			if (!p || !p.isActive) return fail("Гравця немає")
			if (s.mode === "judge" && s.currentJudgeId === p.id) return fail("Ти суддя цього раунду")
			if (s.submissions.some((x) => x.playerId === p.id)) return fail("Ти вже обрав мем")
			const idx = p.hand.indexOf(action.memeCardId)
			if (idx === -1) return fail("Цього мему немає в руці")
			p.hand.splice(idx, 1)
			s.submissions.push({ id: "s" + s.idSeq++, playerId: p.id, memeCardId: action.memeCardId, votes: 0, isWinner: false })
			maybeResolve(s, rng)
			bump(s)
			return { state: s }
		}

		case "judge": {
			if (s.mode !== "judge") return fail("Це не режим судді")
			if (s.phase !== "judging") return fail("Зараз не час")
			if (s.currentJudgeId !== action.playerId) return fail("Тільки суддя може обирати")
			const sub = s.submissions.find((x) => x.id === action.submissionId)
			if (!sub) return fail("Submission не знайдено")
			awardWin(s, sub)
			bump(s)
			return { state: s }
		}

		case "vote": {
			if (s.mode !== "vote") return fail("Це не режим голосування")
			if (s.phase !== "judging") return fail("Зараз не час")
			const sub = s.submissions.find((x) => x.id === action.submissionId)
			if (!sub) return fail("Submission не знайдено")
			if (sub.playerId === action.playerId) return fail("Не можна голосувати за себе")
			if (s.votes.some((v) => v.voterId === action.playerId)) return fail("Ти вже проголосував")
			s.votes.push({ voterId: action.playerId, submissionId: sub.id })
			sub.votes++
			maybeResolve(s, rng)
			bump(s)
			return { state: s }
		}

		case "nextRound": {
			if (s.phase !== "results") return fail("Раунд ще не закінчився")
			const champ = s.players.find((p) => p.isActive && p.score >= s.targetScore)
			if (champ) {
				s.phase = "finished"
				bump(s)
				return { state: s }
			}
			for (const p of activePlayers(s)) {
				const need = HAND_SIZE - p.hand.length
				if (need > 0) dealCards(s, p, need, rng)
			}
			s.round++
			s.submissions = []
			s.votes = []
			s.currentSituationId = pickSituation(s, rng)
			s.currentJudgeId = s.mode === "judge" ? nextJudge(s, s.currentJudgeId) : null
			s.phase = "playing"
			bump(s)
			return { state: s }
		}

		case "botTick": {
			// Обробляємо ОДИН крок першого бота, який може ходити (хост тикає по таймеру).
			const acted = botStep(s, rng)
			if (!acted) return { state: prev }
			bump(s)
			return { state: s }
		}
	}
}

// ============================================================================
// ВНУТРІШНІ ХЕЛПЕРИ
// ============================================================================
function clone(s: GameState): GameState {
	return {
		...s,
		players: s.players.map((p) => ({ ...p, hand: [...p.hand] })),
		submissions: s.submissions.map((x) => ({ ...x })),
		votes: s.votes.map((v) => ({ ...v })),
		usedSituationIds: [...s.usedSituationIds],
	}
}

function bump(s: GameState) {
	s.seq++
}

function activePlayers(s: GameState): Player[] {
	return s.players.filter((p) => p.isActive)
}

function pickColor(s: GameState): string {
	const used = new Set(s.players.map((p) => p.avatarColor))
	return AVATAR_COLORS.find((c) => !used.has(c)) || AVATAR_COLORS[s.players.length % AVATAR_COLORS.length]
}

function dealCards(s: GameState, player: Player, count: number, rng: Rng) {
	const held = new Set(player.hand)
	const pool = MEME_CARDS.filter((m) => !held.has(m.id))
	shuffle(pool, rng)
	for (let i = 0; i < count && i < pool.length; i++) player.hand.push(pool[i].id)
}

// АНТИ-ПОВТОР: беремо ситуацію, яка ще не була в цій кімнаті (покращення vs сервер).
function pickSituation(s: GameState, rng: Rng): number | null {
	if (SITUATIONS.length === 0) return null
	let pool = SITUATIONS.filter((x) => !s.usedSituationIds.includes(x.id))
	if (pool.length === 0) {
		s.usedSituationIds = []
		pool = SITUATIONS.slice()
	}
	const chosen = pool[Math.floor(rng() * pool.length)]
	s.usedSituationIds.push(chosen.id)
	return chosen.id
}

function nextJudge(s: GameState, currentJudgeId: string | null): string | null {
	const active = activePlayers(s)
	if (active.length === 0) return null
	if (!currentJudgeId) return active[0].id
	const idx = active.findIndex((p) => p.id === currentJudgeId)
	if (idx === -1) return active[0].id
	return active[(idx + 1) % active.length].id
}

function expectedSubmissions(s: GameState): number {
	const active = activePlayers(s).length
	return s.mode === "judge" ? Math.max(0, active - 1) : active
}

// Перехід playing -> judging, коли всі здали; або резолюція голосування.
function maybeResolve(s: GameState, rng: Rng) {
	if (s.phase === "playing") {
		if (s.submissions.length >= expectedSubmissions(s) && s.submissions.length > 0) {
			s.phase = "judging"
		}
		return
	}
	if (s.phase === "judging" && s.mode === "vote") {
		const submitters = new Set(s.submissions.map((x) => x.playerId))
		if (s.votes.length >= submitters.size && submitters.size > 0) {
			const ranked = [...s.submissions].sort((a, b) => b.votes - a.votes || seqOf(a.id) - seqOf(b.id))
			if (ranked.length > 0) awardWin(s, ranked[0])
		}
	}
}

function awardWin(s: GameState, sub: Submission) {
	sub.isWinner = true
	const winner = s.players.find((p) => p.id === sub.playerId)
	if (winner) winner.score++
	s.phase = "results"
}

// Один крок бота. Підтримує ДЕКІЛЬКА ботів (покращення vs сервер).
// Повертає true, якщо бот щось зробив.
function botStep(s: GameState, rng: Rng): boolean {
	const bots = s.players.filter((p) => p.isBot && p.isActive)
	if (bots.length === 0) return false

	if (s.phase === "playing") {
		for (const bot of bots) {
			if (s.mode === "judge" && s.currentJudgeId === bot.id) continue
			if (s.submissions.some((x) => x.playerId === bot.id)) continue
			if (bot.hand.length === 0) dealCards(s, bot, HAND_SIZE, rng)
			const cardId = bot.hand[Math.floor(rng() * bot.hand.length)]
			const idx = bot.hand.indexOf(cardId)
			bot.hand.splice(idx, 1)
			s.submissions.push({ id: "s" + s.idSeq++, playerId: bot.id, memeCardId: cardId, votes: 0, isWinner: false })
			maybeResolve(s, rng)
			return true
		}
	}

	if (s.phase === "judging") {
		if (s.mode === "judge") {
			const judge = s.players.find((p) => p.id === s.currentJudgeId)
			if (judge && judge.isBot && s.submissions.length > 0) {
				const pick = s.submissions[Math.floor(rng() * s.submissions.length)]
				awardWin(s, pick)
				return true
			}
		} else {
			for (const bot of bots) {
				if (s.votes.some((v) => v.voterId === bot.id)) continue
				const eligible = s.submissions.filter((x) => x.playerId !== bot.id)
				if (eligible.length === 0) continue
				const pick = eligible[Math.floor(rng() * eligible.length)]
				s.votes.push({ voterId: bot.id, submissionId: pick.id })
				pick.votes++
				maybeResolve(s, rng)
				return true
			}
		}
	}
	return false
}

function shuffle<T>(arr: T[], rng: Rng) {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1))
		;[arr[i], arr[j]] = [arr[j], arr[i]]
	}
}

// Допоміжне: порядок сабмітів за їхнім id (”s" + N").
function seqOf(id: string): number {
	const n = parseInt(id.replace(/^s/, ""), 10)
	return isNaN(n) ? 0 : n
}

// ============================================================================
// CLIENT VIEW — що бачить конкретний гравець (ховає авторів, чужі руки)
// ============================================================================
export interface ClientView {
	code: string
	phase: Phase
	mode: Mode
	language: Lang
	targetScore: number
	round: number
	hostPlayerId: string | null
	currentJudgeId: string | null
	situation: Situation | null
	players: Array<{ id: string; nickname: string; score: number; avatarColor: string; isActive: boolean; isBot: boolean }>
	myId: string
	isHost: boolean
	isJudge: boolean
	myHand: MemeCard[]
	submissions: Array<{
		id: string
		memeCardId: number
		image_url: string
		title: string
		votes: number
		isWinner: boolean
		isMine: boolean
		playerId: string | null
		nickname: string | null
		avatarColor: string | null
	}>
	hasSubmitted: boolean
	hasVoted: boolean
	seq: number
}

const memeById = new Map(MEME_CARDS.map((m) => [m.id, m]))
const situationById = new Map(SITUATIONS.map((x) => [x.id, x]))

export function viewFor(s: GameState, playerId: string): ClientView {
	const me = s.players.find((p) => p.id === playerId)
	const hideAuthors = s.phase !== "results" && s.phase !== "finished"
	return {
		code: s.code,
		phase: s.phase,
		mode: s.mode,
		language: s.language,
		targetScore: s.targetScore,
		round: s.round,
		hostPlayerId: s.hostPlayerId,
		currentJudgeId: s.currentJudgeId,
		situation: s.currentSituationId ? situationById.get(s.currentSituationId) || null : null,
		players: s.players.map((p) => ({
			id: p.id, nickname: p.nickname, score: p.score,
			avatarColor: p.avatarColor, isActive: p.isActive, isBot: p.isBot,
		})),
		myId: playerId,
		isHost: s.hostPlayerId === playerId,
		isJudge: s.currentJudgeId === playerId,
		myHand: me ? me.hand.map((id) => memeById.get(id)!).filter(Boolean) : [],
		submissions: s.submissions.map((sub) => {
			const card = memeById.get(sub.memeCardId)
			const author = s.players.find((p) => p.id === sub.playerId)
			return {
				id: sub.id,
				memeCardId: sub.memeCardId,
				image_url: card?.image_url || "",
				title: card?.title || "",
				votes: sub.votes,
				isWinner: sub.isWinner,
				isMine: sub.playerId === playerId,
				playerId: hideAuthors ? null : sub.playerId,
				nickname: hideAuthors ? null : author?.nickname || null,
				avatarColor: hideAuthors ? null : author?.avatarColor || null,
			}
		}),
		hasSubmitted: s.submissions.some((x) => x.playerId === playerId),
		hasVoted: s.votes.some((v) => v.voterId === playerId),
		seq: s.seq,
	}
}
