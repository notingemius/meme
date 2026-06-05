// ============================================================================
// ЕКРАН «РЯДОМ ПО Wi-Fi» — локальна гра без сервера.
// ----------------------------------------------------------------------------
// Один телефон — хост (створює гру, показує QR з IP). Інші — сканують QR
// або вводять IP вручну. Цикл гри рендериться з персонального ClientView.
//
// ⚠️ Потребує власний білд (dev-build/APK) — native-модулі сокетів/камери.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react"
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	ActivityIndicator,
	Alert,
	Image,
	StyleSheet,
} from "react-native"
// FIX (white screen): see SafeTextInput.tsx — stock TextInput is broken
// under Fabric on Android in react-native 0.81.4. SafeTextInput renders correctly.
import TextInput from "@/components/SafeTextInput"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { useRouter } from "expo-router"
import { Wifi, QrCode, ArrowLeft, Crown } from "lucide-react-native"
import {
	createClientForMode,
	type ClientForMode,
	type ClientView,
	type GameClient,
	type ConnectionState,
} from "@/game/net"

const QR_SCAN_SETTINGS = { barcodeTypes: ["qr"] }
// Джерело картинки для <Image> (винесено, щоб уникнути вкладених фігурних дужок).
const uriSrc = (u: string) => ({ uri: u })

type Step = "choose" | "host" | "join-input" | "play"

export default function WifiScreen() {
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const [step, setStep] = useState<Step>("choose")
	const [nickname, setNickname] = useState("")
	const [hostIp, setHostIp] = useState("")
	const [view, setView] = useState<ClientView | null>(null)
	const [conn, setConn] = useState<ConnectionState>("connecting")
	const [busy, setBusy] = useState(false)
	const clientRef = useRef<GameClient | null>(null)
	const bundleRef = useRef<ClientForMode | null>(null)
	const [myAddress, setMyAddress] = useState<{ ip: string | null; port: number } | null>(null)

	useEffect(() => {
		return () => {
			clientRef.current?.disconnect()
			bundleRef.current?.stopHost?.()
		}
	}, [])

	const wireClient = useCallback((c: GameClient) => {
		c.onState((v) => setView(v))
		c.onConnectionState((s) => setConn(s))
		c.onError((m) => Alert.alert("Помилка", m))
	}, [])

	const startHost = async () => {
		if (!nickname.trim()) return Alert.alert("Введи нік", "Спочатку введи імʼя")
		setBusy(true)
		try {
			const bundle = await createClientForMode({ kind: "wifi-host" })
			bundleRef.current = bundle
			clientRef.current = bundle.client
			setMyAddress(bundle.hostAddress ?? null)
			wireClient(bundle.client)
			await bundle.client.connect(nickname.trim())
			setStep("host")
		} catch (e: any) {
			Alert.alert("Не вдалося створити гру", e?.message ?? "Помилка")
		} finally {
			setBusy(false)
		}
	}

	const startJoin = async () => {
		if (!nickname.trim()) return Alert.alert("Введи нік", "Спочатку введи імʼя")
		if (!hostIp.trim()) return Alert.alert("Введи IP", "Введи IP-адресу хоста або скануй QR")
		const parts = hostIp.trim().split(":")
		const ipPart = parts[0]
		const portPart = parts[1]
		setBusy(true)
		try {
			const bundle = await createClientForMode({
				kind: "wifi-join",
				host: ipPart,
				port: portPart ? Number(portPart) : undefined,
			})
			bundleRef.current = bundle
			clientRef.current = bundle.client
			wireClient(bundle.client)
			await bundle.client.connect(nickname.trim())
			setStep("play")
		} catch (e: any) {
			Alert.alert("Не вдалося підключитися", e?.message ?? "Перевір Wi-Fi та IP")
		} finally {
			setBusy(false)
		}
	}

	const send = (a: any) => clientRef.current?.send(a)

	if (step === "choose") {
		return (
			<View style={[styles.container, { paddingTop: insets.top + 16 }]}>
				<StatusBar style="light" />
				<TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
					<ArrowLeft color="#94A3B8" size={26} />
				</TouchableOpacity>
				<Text style={styles.h1}>Рядом по Wi-Fi</Text>
				<Text style={styles.sub}>
					Грайте разом без інтернету. Всі телефони мають бути в одній Wi-Fi-мережі.
				</Text>
				<TextInput
					placeholder="Твоє імʼя"
					placeholderTextColor="#64748B"
					value={nickname}
					onChangeText={setNickname}
					style={styles.input}
				/>
				<TouchableOpacity onPress={startHost} disabled={busy} style={styles.primaryBtn}>
					<Wifi color="#fff" size={22} />
					<Text style={styles.primaryBtnText}>Створити гру (я — хост)</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => setStep("join-input")} disabled={busy} style={styles.secondaryBtn}>
					<QrCode color="#fff" size={22} />
					<Text style={styles.primaryBtnText}>Приєднатися до гри</Text>
				</TouchableOpacity>
				{busy ? <ActivityIndicator color="#6366F1" style={styles.spinner} /> : null}
			</View>
		)
	}

	if (step === "host") {
		return (
			<HostLobby
				insets={insets}
				address={myAddress}
				view={view}
				conn={conn}
				onAddBot={() => send({ type: "addBot" })}
				onStart={() => send({ type: "start" })}
				onContinue={() => setStep("play")}
				onBack={() => router.back()}
			/>
		)
	}

	if (step === "join-input") {
		return (
			<JoinInput
				insets={insets}
				hostIp={hostIp}
				setHostIp={setHostIp}
				busy={busy}
				onJoin={startJoin}
				onBack={() => setStep("choose")}
			/>
		)
	}

	return <GameView insets={insets} view={view} conn={conn} send={send} onExit={() => router.back()} />
}

// ============================================================================
// ПІДКОМПОНЕНТИ
// ============================================================================

function QrBox({ value }: { value: string }) {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const QRCode = require("react-native-qrcode-svg").default
		return (
			<View style={styles.qrBox}>
				<QRCode value={value} size={200} />
			</View>
		)
	} catch {
		return (
			<View style={styles.qrFallback}>
				<Text style={styles.sub}>QR недоступний. Продиктуй IP вручну:</Text>
				<Text style={styles.addr}>{value}</Text>
			</View>
		)
	}
}

function HostLobby({ insets, address, view, conn, onAddBot, onStart, onContinue, onBack }: any) {
	const ip = address?.ip ?? null
	const payload = ip ? ip + ":" + address.port : "Шукаю IP…"
	const players = view?.players ?? []
	const started = view && view.phase !== "lobby"
	useEffect(() => {
		if (started) onContinue()
	}, [started])
	return (
		<ScrollView style={styles.container} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}>
			<StatusBar style="light" />
			<TouchableOpacity onPress={onBack} style={styles.backBtn}>
				<ArrowLeft color="#94A3B8" size={26} />
			</TouchableOpacity>
			<Text style={styles.h1}>Ти — хост</Text>
			<Text style={styles.sub}>Інші сканують QR або вводять IP, щоб приєднатися.</Text>
			<View style={styles.qrWrap}>
				<QrBox value={payload} />
				<Text style={styles.addr}>{payload}</Text>
				{conn !== "connected" ? <Text style={styles.warn}>{conn}…</Text> : null}
			</View>
			<Text style={styles.section}>Гравці ({players.length})</Text>
			{players.map((p: any) => (
				<View key={p.id} style={styles.playerRow}>
					<View style={[styles.dot, { backgroundColor: p.avatarColor }]} />
					<Text style={styles.playerName}>{p.nickname}{p.isBot ? " 🤖" : ""}</Text>
				</View>
			))}
			<TouchableOpacity onPress={onAddBot} style={styles.secondaryBtn}>
				<Text style={styles.primaryBtnText}>+ Додати бота</Text>
			</TouchableOpacity>
			<TouchableOpacity onPress={onStart} disabled={players.length < 3} style={[styles.primaryBtn, players.length < 3 ? styles.disabled : null]}>
				<Text style={styles.primaryBtnText}>{players.length < 3 ? "Потрібно ≥ 3 учасників" : "Почати гру"}</Text>
			</TouchableOpacity>
		</ScrollView>
	)
}

function JoinInput({ insets, hostIp, setHostIp, busy, onJoin, onBack }: any) {
	const [scanning, setScanning] = useState(false)
	let CameraView: any = null
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		CameraView = require("expo-camera").CameraView
	} catch {
		CameraView = null
	}
	return (
		<View style={[styles.container, { paddingTop: insets.top + 16 }]}>
			<StatusBar style="light" />
			<TouchableOpacity onPress={onBack} style={styles.backBtn}>
				<ArrowLeft color="#94A3B8" size={26} />
			</TouchableOpacity>
			<Text style={styles.h1}>Приєднатися</Text>
			{scanning && CameraView ? (
				<View style={styles.camera}>
					<CameraView
						style={styles.cameraFill}
						barcodeScannerSettings={QR_SCAN_SETTINGS}
						onBarcodeScanned={(res: any) => {
							setHostIp(String(res?.data ?? "").replace(/^.*?:\/\//, "").split("/")[0])
							setScanning(false)
						}}
					/>
				</View>
			) : (
				<>
					<TextInput
						placeholder="IP хоста, напр. 192.168.0.5"
						placeholderTextColor="#64748B"
						value={hostIp}
						onChangeText={setHostIp}
						autoCapitalize="none"
						style={styles.input}
					/>
					{CameraView ? (
						<TouchableOpacity onPress={() => setScanning(true)} style={styles.secondaryBtn}>
							<QrCode color="#fff" size={20} />
							<Text style={styles.primaryBtnText}>Сканувати QR</Text>
						</TouchableOpacity>
					) : null}
				</>
			)}
			<TouchableOpacity onPress={onJoin} disabled={busy} style={styles.primaryBtn}>
				{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Підключитися</Text>}
			</TouchableOpacity>
		</View>
	)
}

function GameView({ insets, view, conn, send, onExit }: any) {
	if (!view) {
		return (
			<View style={styles.center}>
				<ActivityIndicator color="#6366F1" />
				<Text style={styles.sub}>{conn === "reconnecting" ? "Перепідключення…" : "Зʼєднання…"}</Text>
			</View>
		)
	}
	const v: ClientView = view
	const situationText = v.situation ? (v.language === "ru" ? v.situation.text_ru : v.situation.text_ua) : ""
	return (
		<ScrollView style={styles.container} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}>
			<StatusBar style="light" />
			<View style={styles.topBar}>
				<TouchableOpacity onPress={onExit}><ArrowLeft color="#94A3B8" size={24} /></TouchableOpacity>
				<Text style={styles.roundText}>Раунд {v.round} · до {v.targetScore}</Text>
				{conn !== "connected" ? <Text style={styles.warn}>{conn}…</Text> : <View style={styles.spacer} />}
			</View>

			<View style={styles.scoreWrap}>
				{v.players.map((p) => (
					<View key={p.id} style={styles.scoreChip}>
						<View style={[styles.dotSm, { backgroundColor: p.avatarColor }]} />
						<Text style={styles.scoreText}>{p.nickname}: {p.score}</Text>
						{p.id === v.currentJudgeId ? <Crown color="#FBBF24" size={13} /> : null}
					</View>
				))}
			</View>

			{situationText ? (
				<View style={styles.situationCard}>
					<Text style={styles.situationText}>{situationText}</Text>
				</View>
			) : null}

			{v.phase === "playing" && !v.isJudge && !v.hasSubmitted ? (
				<>
					<Text style={styles.section}>Обери мем:</Text>
					{v.myHand.map((c) => (
						<TouchableOpacity key={c.id} onPress={() => send({ type: "submit", memeCardId: c.id })} style={styles.card}>
							<Image source={uriSrc(c.image_url)} style={styles.cardImg} resizeMode="cover" />
						</TouchableOpacity>
					))}
				</>
			) : null}
			{v.phase === "playing" && v.isJudge ? <Text style={styles.hint}>Ти — суддя. Чекай на відповіді гравців…</Text> : null}
			{v.phase === "playing" && !v.isJudge && v.hasSubmitted ? <Text style={styles.hint}>Відповідь надіслано. Чекаймо інших…</Text> : null}

			{v.phase === "judging" ? (
				<>
					<Text style={styles.section}>
						{v.mode === "judge" ? (v.isJudge ? "Обери найкращий мем:" : "Суддя обирає…") : v.hasVoted ? "Голос зараховано…" : "Проголосуй за мем:"}
					</Text>
					{v.submissions.map((s) => {
						const canPick = (v.mode === "judge" && v.isJudge) || (v.mode === "vote" && !v.hasVoted && !s.isMine)
						return (
							<TouchableOpacity key={s.id} disabled={!canPick} onPress={() => send({ type: v.mode === "judge" ? "judge" : "vote", submissionId: s.id })} style={[styles.card, !canPick ? styles.cardDim : null]}>
								<Image source={uriSrc(s.image_url)} style={styles.cardImg} resizeMode="cover" />
								{s.isMine ? <Text style={styles.cardBadge}>твій</Text> : null}
							</TouchableOpacity>
						)
					})}
				</>
			) : null}

			{v.phase === "results" ? (
				<>
					<Text style={styles.section}>Результати раунду</Text>
					{v.submissions.map((s) => (
						<View key={s.id} style={[styles.card, s.isWinner ? styles.cardWin : null]}>
							<Image source={uriSrc(s.image_url)} style={styles.cardImg} resizeMode="cover" />
							<Text style={styles.cardBadge}>{s.isWinner ? "🏆 " : ""}{s.nickname}{v.mode === "vote" ? " · " + s.votes + " гол." : ""}</Text>
						</View>
					))}
					{v.isHost ? (
						<TouchableOpacity onPress={() => send({ type: "nextRound" })} style={styles.primaryBtn}>
							<Text style={styles.primaryBtnText}>Наступний раунд</Text>
						</TouchableOpacity>
					) : null}
				</>
			) : null}

			{v.phase === "finished" ? (
				<View style={styles.finishWrap}>
					<Crown color="#FBBF24" size={48} />
					<Text style={styles.h1}>Гра завершена!</Text>
					{[...v.players].sort((a, b) => b.score - a.score).map((p, i) => (
						<Text key={p.id} style={styles.finishRow}>{i + 1}. {p.nickname} — {p.score}</Text>
					))}
					<TouchableOpacity onPress={onExit} style={styles.primaryBtn}>
						<Text style={styles.primaryBtnText}>Готово</Text>
					</TouchableOpacity>
				</View>
			) : null}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#0F172A", paddingHorizontal: 20 },
	scroll: { paddingBottom: 40 },
	center: { flex: 1, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center", gap: 12 },
	backBtn: { width: 40, height: 40, justifyContent: "center" },
	spinner: { marginTop: 16 },
	spacer: { width: 40 },
	h1: { color: "#F1F5F9", fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 8 },
	sub: { color: "#94A3B8", fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 8, lineHeight: 20 },
	input: { backgroundColor: "#1E293B", color: "#F1F5F9", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginTop: 20, fontFamily: "Inter_500Medium" },
	primaryBtn: { backgroundColor: "#6366F1", borderRadius: 14, paddingVertical: 16, marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
	secondaryBtn: { backgroundColor: "#334155", borderRadius: 14, paddingVertical: 16, marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
	primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
	disabled: { backgroundColor: "#475569" },
	qrWrap: { alignItems: "center", marginTop: 20 },
	qrBox: { backgroundColor: "#fff", padding: 16, borderRadius: 16 },
	qrFallback: { backgroundColor: "#1E293B", padding: 20, borderRadius: 16, alignItems: "center" },
	addr: { color: "#A5B4FC", fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 12, letterSpacing: 1 },
	warn: { color: "#FBBF24", fontSize: 13, marginTop: 6, fontFamily: "Inter_500Medium" },
	section: { color: "#E2E8F0", fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 24, marginBottom: 8 },
	playerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
	dot: { width: 14, height: 14, borderRadius: 7 },
	dotSm: { width: 9, height: 9, borderRadius: 5 },
	playerName: { color: "#F1F5F9", fontSize: 15, fontFamily: "Inter_500Medium" },
	camera: { height: 280, borderRadius: 16, overflow: "hidden", marginTop: 20 },
	cameraFill: { flex: 1 },
	topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
	roundText: { color: "#E2E8F0", fontSize: 15, fontFamily: "Inter_600SemiBold" },
	scoreWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
	scoreChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#1E293B", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
	scoreText: { color: "#CBD5E1", fontSize: 12, fontFamily: "Inter_500Medium" },
	situationCard: { backgroundColor: "#312E81", borderRadius: 16, padding: 20, marginBottom: 8 },
	situationText: { color: "#EEF2FF", fontSize: 18, fontFamily: "Inter_600SemiBold", lineHeight: 26 },
	card: { backgroundColor: "#1E293B", borderRadius: 14, padding: 16, marginTop: 10 },
	cardDim: { opacity: 0.5 },
	cardWin: { backgroundColor: "#166534" },
	cardText: { color: "#F1F5F9", fontSize: 15, fontFamily: "Inter_500Medium" },
	cardImg: { width: "100%", height: 240, borderRadius: 10, backgroundColor: "#0F172A" },
	cardBadge: { color: "#E2E8F0", fontSize: 13, marginTop: 8, fontFamily: "Inter_500Medium" },
	cardSub: { color: "#94A3B8", fontSize: 12, marginTop: 4, fontFamily: "Inter_400Regular" },
	hint: { color: "#94A3B8", fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center", marginTop: 24 },
	finishWrap: { alignItems: "center", marginTop: 30, gap: 6 },
	finishRow: { color: "#E2E8F0", fontSize: 16, fontFamily: "Inter_500Medium", marginTop: 4 },
})
