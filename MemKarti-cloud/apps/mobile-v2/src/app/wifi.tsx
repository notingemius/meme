import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LanHost, LanClient, getLocalIp, scanSubnet, type FoundHost, Peer } from '@/game/lanNet';
import {
  createLobby,
  addPlayer,
  removePlayer,
  startRound,
  submitPick,
  castVote,
  updateSettings,
  postChatMessage,
  viewForPlayer,
  type LanGameState,
  type ClientView,
  type ClientMsg,
  type ServerMsg,
} from '@/game/lanGame';
import { botsSubmit, botsVote } from '@/game/soloBots';
import { autoPickHumans, autoVoteHumans } from '@/game/autoPlay';
import { LanGameUI } from '@/components/LanGameUI';
import { Avatar } from '@/components/Avatar';
import { SettingsChips } from '@/components/SettingsChips';
import { LobbyChat } from '@/components/LobbyChat';
import { randomNick } from '@/game/nickGen';

const BOT_NAMES = ['Богдан', 'Олена', 'Тарас', 'Маша', 'Петро', 'Софія', 'Назар'];

type Mode = 'menu' | 'host' | 'join';

export default function WifiScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('menu');
  const [nickname, setNickname] = useState('');

  if (mode === 'host') {
    return <HostFlow insets={insets} nickname={nickname} onExit={() => setMode('menu')} />;
  }
  if (mode === 'join') {
    return <JoinFlow insets={insets} nickname={nickname} onExit={() => setMode('menu')} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB', paddingTop: insets.top + 16 }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ paddingVertical: 6 }}>
          <Text style={{ color: '#2563EB', fontSize: 14, fontWeight: '600' }}>← На головну</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Гра по Wi-Fi</Text>
        <Text style={styles.subtitle}>
          Усі телефони мають бути в одній Wi-Fi мережі (або підключитись до хотспоту одного телефону).
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.label}>ТВІЙ НІК</Text>
          <TouchableOpacity
            onPress={() => setNickname(randomNick())}
            style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginTop: 18 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '600' }}>🎲 Випадковий</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          value={nickname}
          onChangeText={setNickname}
          placeholder="Наприклад: Олег"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          maxLength={20}
        />

        <TouchableOpacity
          onPress={() => {
            if (!nickname.trim()) {
              Alert.alert('Введи нік');
              return;
            }
            setMode('host');
          }}
          style={[styles.btnPrimary, { marginTop: 24 }]}
        >
          <Text style={styles.btnPrimaryText}>Створити кімнату (хост)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (!nickname.trim()) {
              Alert.alert('Введи нік');
              return;
            }
            setMode('join');
          }}
          style={[styles.btnSecondary, { marginTop: 12 }]}
        >
          <Text style={styles.btnSecondaryText}>Знайти / приєднатись</Text>
        </TouchableOpacity>

        <View style={styles.howCard}>
          <Text style={styles.howTitle}>Як це працює</Text>
          <Text style={styles.howLine}>1. Один грає за хоста — отримує IP</Text>
          <Text style={styles.howLine}>2. Інші натискають «Знайти» — телефон сам сканує мережу</Text>
          <Text style={styles.howLine}>3. Тапни на знайденого хоста — підключишся</Text>
          <Text style={styles.howLine}>4. Хост починає гру — у кожного 8 мемів</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ============================================================================
// HOST FLOW
// ============================================================================
function HostFlow({
  insets,
  nickname,
  onExit,
}: {
  insets: { top: number; bottom: number };
  nickname: string;
  onExit: () => void;
}) {
  const hostRef = useRef<LanHost | null>(null);
  const stateRef = useRef<LanGameState>(createLobby(nickname));
  const [state, setState] = useState<LanGameState>(stateRef.current);
  const [ip, setIp] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());

  const updateState = (newState: LanGameState) => {
    stateRef.current = newState;
    setState(newState);
    // broadcast each peer
    for (const [peerId, peer] of peersRef.current.entries()) {
      const view = viewForPlayer(newState, peerId);
      const msg: ServerMsg = { t: 'view', view };
      peer.send(msg);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const localIp = await getLocalIp();
        if (mounted) setIp(localIp ?? '???');
      } catch {
        if (mounted) setIp('???');
      }
      try {
        const host = new LanHost();
        host.onPeerConnected((peer) => {
          // Сразу шлём serverInfo — для сканеров (они отключатся, не делая hello).
          const info: ServerMsg = {
            t: 'serverInfo',
            nickname,
            players: stateRef.current.players.length,
          };
          peer.send(info);

          peer.onMessage((line) => {
            try {
              const msg = JSON.parse(line) as ClientMsg;
              if (msg.t === 'hello') {
                peersRef.current.set(peer.id, peer);
                const welcome: ServerMsg = { t: 'welcome', myId: peer.id };
                peer.send(welcome);
                updateState(addPlayer(stateRef.current, peer.id, msg.nickname));
              } else if (msg.t === 'submit') {
                updateState(submitPick(stateRef.current, peer.id, msg.memeCardId));
              } else if (msg.t === 'vote') {
                updateState(castVote(stateRef.current, peer.id, msg.submissionId));
              } else if (msg.t === 'chat') {
                updateState(postChatMessage(stateRef.current, peer.id, msg.text));
              }
            } catch (e) {
              console.log('parse err', e);
            }
          });
          peer.onClose(() => {
            if (peersRef.current.has(peer.id)) {
              peersRef.current.delete(peer.id);
              updateState(removePlayer(stateRef.current, peer.id));
            }
          });
        });
        await host.start();
        hostRef.current = host;
      } catch (e: any) {
        if (mounted) setErr(e?.message ?? String(e));
      }
    })();
    return () => {
      mounted = false;
      hostRef.current?.stop();
    };
  }, [nickname]);

  // Хост-локальные действия
  const onHostSubmit = (memeCardId: number) => {
    updateState(submitPick(stateRef.current, 'host', memeCardId));
  };
  const onHostVote = (subId: string) => {
    updateState(castVote(stateRef.current, 'host', subId));
  };
  const onStartRound = () => {
    updateState(startRound(stateRef.current));
  };
  // Реванш: сбрасываем игру до лобби с теми же игроками + 0 очков.
  const onRematch = () => {
    const fresh = createLobby(nickname);
    let s = fresh;
    for (const [peerId, _peer] of peersRef.current.entries()) {
      const oldPlayer = stateRef.current.players.find((p) => p.id === peerId);
      if (oldPlayer) {
        s = addPlayer(s, peerId, oldPlayer.nickname);
      }
    }
    // Возвращаем ботов (они не peer'ы)
    for (const p of stateRef.current.players) {
      if (p.id.startsWith('bot') && !s.players.some((x) => x.id === p.id)) {
        s = addPlayer(s, p.id, p.nickname);
      }
    }
    updateState(s);
  };

  // Добавить бота в лобби.
  const onAddBot = () => {
    const usedNames = new Set(stateRef.current.players.map((p) => p.nickname));
    const free = BOT_NAMES.find((n) => !usedNames.has(n)) ?? `Бот${stateRef.current.players.length}`;
    const id = `bot${Date.now()}`;
    updateState(addPlayer(stateRef.current, id, free));
  };

  // Изменение настроек в лобби.
  const onChangeRounds = (n: number) => updateState(updateSettings(stateRef.current, { totalRounds: n }));
  const onChangePickSec = (n: number) => updateState(updateSettings(stateRef.current, { pickSeconds: n }));
  const onChangeVoteSec = (n: number) => updateState(updateSettings(stateRef.current, { voteSeconds: n }));

  // Хост шлёт сообщение в чат от своего имени.
  const onHostChat = (text: string) => {
    updateState(postChatMessage(stateRef.current, 'host', text));
  };

  // Боты автоматически submit'ят в фазе pick (после некоторой задержки).
  useEffect(() => {
    if (state.phase !== 'pick') return;
    const hasBots = state.players.some((p) => p.id.startsWith('bot'));
    if (!hasBots) return;
    const allBotsPicked = state.players
      .filter((p) => p.id.startsWith('bot'))
      .every((p) => state.submissions.some((s) => s.playerId === p.id));
    if (allBotsPicked) return;
    const t = setTimeout(() => updateState(botsSubmit(stateRef.current)), 1500);
    return () => clearTimeout(t);
  }, [state.phase, state.submissions]);

  // Боты автоматически голосуют в фазе vote.
  useEffect(() => {
    if (state.phase !== 'vote') return;
    const hasBots = state.players.some((p) => p.id.startsWith('bot'));
    if (!hasBots) return;
    const allBotsVoted = state.players
      .filter((p) => p.id.startsWith('bot'))
      .every((p) => state.votes[p.id]);
    if (allBotsVoted) return;
    const t = setTimeout(() => updateState(botsVote(stateRef.current)), 2000);
    return () => clearTimeout(t);
  }, [state.phase, state.votes]);

  // Таймер pick: автопик для тех людей, кто не успел.
  useEffect(() => {
    if (state.phase !== 'pick') return;
    const allHumansPicked = state.players
      .filter((p) => !p.id.startsWith('bot'))
      .every((p) => state.submissions.some((s) => s.playerId === p.id));
    if (allHumansPicked) return;
    const t = setTimeout(() => {
      updateState(autoPickHumans(stateRef.current));
    }, state.pickSeconds * 1000);
    return () => clearTimeout(t);
  }, [state.phase, state.submissions, state.round, state.pickSeconds]);

  // Таймер vote: автоголос для лагающих людей.
  useEffect(() => {
    if (state.phase !== 'vote') return;
    const allHumansVoted = state.players
      .filter((p) => !p.id.startsWith('bot'))
      .every((p) => state.votes[p.id]);
    if (allHumansVoted) return;
    const t = setTimeout(() => {
      updateState(autoVoteHumans(stateRef.current));
    }, state.voteSeconds * 1000);
    return () => clearTimeout(t);
  }, [state.phase, state.votes, state.round, state.voteSeconds]);

  if (err) {
    return (
      <View style={[styles.errBox, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.errTitle}>Помилка запуску хоста</Text>
        <Text style={styles.errText}>{err}</Text>
        <TouchableOpacity onPress={onExit} style={styles.btnSecondary}>
          <Text style={styles.btnSecondaryText}>← Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (state.phase === 'lobby') {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', paddingTop: insets.top + 16 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <TouchableOpacity onPress={onExit}>
            <Text style={{ color: '#2563EB', fontSize: 14, fontWeight: '600' }}>← Завершити</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Ти — хост</Text>
          <View style={styles.ipBox}>
            <Text style={styles.ipLabel}>ТВІЙ IP (інші можуть знайти через «Знайти»)</Text>
            <Text style={styles.ipValue}>{ip ?? 'Завантаження…'}</Text>
          </View>
          <Text style={styles.sectionLabel}>НАЛАШТУВАННЯ ГРИ</Text>
          <SettingsChips
            label="Раунди"
            emoji="🎯"
            value={state.totalRounds}
            options={[
              { value: 3, label: '3' },
              { value: 5, label: '5' },
              { value: 7, label: '7' },
              { value: 10, label: '10' },
            ]}
            onChange={onChangeRounds}
          />
          <SettingsChips
            label="Час на вибір мема"
            emoji="⏱️"
            value={state.pickSeconds}
            options={[
              { value: 15, label: '15с' },
              { value: 30, label: '30с' },
              { value: 60, label: '60с' },
            ]}
            onChange={onChangePickSec}
          />
          <SettingsChips
            label="Час на голос"
            emoji="🗳️"
            value={state.voteSeconds}
            options={[
              { value: 10, label: '10с' },
              { value: 20, label: '20с' },
              { value: 45, label: '45с' },
            ]}
            onChange={onChangeVoteSec}
          />

          <Text style={styles.sectionLabel}>ГРАВЦІ ({state.players.length})</Text>
          {state.players.map((p) => (
            <View key={p.id} style={styles.playerRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Avatar id={p.id} nickname={p.nickname} size={32} />
                <Text style={[styles.playerName, { marginLeft: 10 }]}>
                  {p.id.startsWith('bot') ? '🤖 ' : ''}{p.nickname}
                </Text>
              </View>
              {p.id === 'host' && <Text style={styles.youBadge}>ТИ (хост)</Text>}
              {p.id.startsWith('bot') && <Text style={styles.botBadge}>БОТ</Text>}
            </View>
          ))}

          <TouchableOpacity
            onPress={onAddBot}
            disabled={state.players.length >= 8}
            style={[styles.btnGhost, { marginTop: 8, opacity: state.players.length >= 8 ? 0.5 : 1 }]}
          >
            <Text style={styles.btnGhostText}>+ Додати бота</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onStartRound}
            disabled={state.players.length < 2}
            style={[
              styles.btnPrimary,
              { marginTop: 16, opacity: state.players.length < 2 ? 0.5 : 1 },
            ]}
          >
            <Text style={styles.btnPrimaryText}>
              {state.players.length < 2 ? 'Чекаємо ще гравця (або додай бота)…' : 'Почати гру'}
            </Text>
          </TouchableOpacity>

          <LobbyChat
            messages={state.chat}
            myId="host"
            onSend={onHostChat}
          />
        </ScrollView>
      </View>
    );
  }

  const view = viewForPlayer(state, 'host');
  return (
    <LanGameUI
      view={view}
      insets={insets}
      isHost
      onSubmit={onHostSubmit}
      onVote={onHostVote}
      onNextRound={onStartRound}
      onExit={onExit}
      onRematch={onRematch}
    />
  );
}

// ============================================================================
// JOIN FLOW (клиент): сканирует сеть + список найденных
// ============================================================================
function JoinFlow({
  insets,
  nickname,
  onExit,
}: {
  insets: { top: number; bottom: number };
  nickname: string;
  onExit: () => void;
}) {
  const [hostIp, setHostIp] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [view, setView] = useState<ClientView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);
  const [found, setFound] = useState<FoundHost[]>([]);

  const clientRef = useRef<LanClient | null>(null);
  const peerRef = useRef<Peer | null>(null);

  useEffect(() => {
    return () => {
      peerRef.current?.close();
      clientRef.current?.close();
    };
  }, []);

  const startScan = async () => {
    setFound([]);
    setScanning(true);
    setScanProgress({ done: 0, total: 254 });
    setErr(null);
    try {
      const hosts = await scanSubnet(undefined, (done, total) => setScanProgress({ done, total }));
      setFound(hosts);
      if (hosts.length === 0) {
        setErr('Хостів не знайдено. Спочатку один з телефонів має створити кімнату.');
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setScanning(false);
    }
  };

  const connect = async (ipToConnect: string) => {
    setConnecting(true);
    setErr(null);
    try {
      const client = new LanClient();
      const peer = await client.connect(ipToConnect.trim());
      clientRef.current = client;
      peerRef.current = peer;
      peer.onMessage((line) => {
        try {
          const msg = JSON.parse(line) as ServerMsg;
          if (msg.t === 'welcome') {
            setMyId(msg.myId);
          } else if (msg.t === 'view') {
            setView(msg.view);
          } else if (msg.t === 'serverInfo') {
            // Тихо игнорируем — это для сканера
          }
        } catch {
          /* ignore */
        }
      });
      peer.onClose(() => {
        setErr('Зʼєднання з хостом розірвано');
      });
      const hello: ClientMsg = { t: 'hello', nickname };
      peer.send(hello);
    } catch (e: any) {
      setErr(e?.message ?? 'Не вдалось підключитись');
    } finally {
      setConnecting(false);
    }
  };

  const onSubmit = (memeCardId: number) => {
    const msg: ClientMsg = { t: 'submit', memeCardId };
    peerRef.current?.send(msg);
  };
  const onVote = (submissionId: string) => {
    const msg: ClientMsg = { t: 'vote', submissionId };
    peerRef.current?.send(msg);
  };
  const onChat = (text: string) => {
    const msg: ClientMsg = { t: 'chat', text };
    peerRef.current?.send(msg);
  };

  // Экран ввода IP / сканера
  if (!myId) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', paddingTop: insets.top + 16 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <TouchableOpacity onPress={onExit}>
            <Text style={{ color: '#2563EB', fontSize: 14, fontWeight: '600' }}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Підключитись до гри</Text>
          <Text style={styles.subtitle}>
            Натисни «Знайти хостів» — телефон просканує Wi-Fi мережу.
            Або введи IP вручну.
          </Text>

          <TouchableOpacity
            onPress={startScan}
            disabled={scanning || connecting}
            style={[styles.btnPrimary, { marginTop: 16, opacity: scanning ? 0.6 : 1 }]}
          >
            {scanning ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator color="#fff" />
                <Text style={[styles.btnPrimaryText, { marginLeft: 10 }]}>
                  Сканую {scanProgress ? `${scanProgress.done}/${scanProgress.total}` : '…'}
                </Text>
              </View>
            ) : (
              <Text style={styles.btnPrimaryText}>🔍 Знайти хостів у мережі</Text>
            )}
          </TouchableOpacity>

          {found.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={styles.label}>ЗНАЙДЕНО ХОСТІВ</Text>
              {found.map((h) => (
                <TouchableOpacity
                  key={h.ip}
                  onPress={() => connect(h.ip)}
                  disabled={connecting}
                  style={styles.foundRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foundNick}>
                      {h.nickname ? `🎮 ${h.nickname}` : '🎮 Хост'}
                    </Text>
                    <Text style={styles.foundIp}>{h.ip}{typeof h.players === 'number' ? ` · ${h.players} гравців` : ''}</Text>
                  </View>
                  <Text style={styles.foundArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>або</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.label}>IP ХОСТА (вручну)</Text>
          <TextInput
            value={hostIp}
            onChangeText={setHostIp}
            placeholder="192.168.1.42"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            style={styles.input}
          />
          <TouchableOpacity
            onPress={() => {
              if (!hostIp.trim()) {
                Alert.alert('Введи IP');
                return;
              }
              connect(hostIp.trim());
            }}
            disabled={connecting}
            style={[styles.btnSecondary, { marginTop: 12, opacity: connecting ? 0.6 : 1 }]}
          >
            {connecting ? (
              <ActivityIndicator color="#2563EB" />
            ) : (
              <Text style={styles.btnSecondaryText}>Підключитись вручну</Text>
            )}
          </TouchableOpacity>

          {err && (
            <View style={styles.errInline}>
              <Text style={styles.errInlineText}>{err}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  if (!view) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24 }]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ marginTop: 16, color: '#6B7280' }}>
          Чекаємо хоста (ID: {myId})…
        </Text>
        <TouchableOpacity onPress={onExit} style={[styles.btnSecondary, { marginTop: 24 }]}>
          <Text style={styles.btnSecondaryText}>← Вийти</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (view.phase === 'lobby') {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', paddingTop: insets.top + 16 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <TouchableOpacity onPress={onExit}>
            <Text style={{ color: '#2563EB', fontSize: 14, fontWeight: '600' }}>← Вийти</Text>
          </TouchableOpacity>
          <Text style={styles.title}>В лобі</Text>
          <Text style={styles.subtitle}>Очікуємо коли хост почне гру…</Text>
          <Text style={styles.sectionLabel}>ГРАВЦІ ({view.players.length})</Text>
          {view.players.map((p) => (
            <View key={p.id} style={styles.playerRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Avatar id={p.id} nickname={p.nickname} size={32} />
                <Text style={[styles.playerName, { marginLeft: 10 }]}>{p.nickname}</Text>
              </View>
              {p.id === view.myId && <Text style={styles.youBadge}>ТИ</Text>}
              {p.id.startsWith('bot') && <Text style={styles.botBadge}>БОТ</Text>}
            </View>
          ))}

          <LobbyChat
            messages={view.chat}
            myId={view.myId}
            onSend={onChat}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <LanGameUI
      view={view}
      insets={insets}
      isHost={false}
      onSubmit={onSubmit}
      onVote={onVote}
      onNextRound={() => {}}
      onExit={onExit}
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#111827', marginTop: 12 },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 6, lineHeight: 20 },
  label: { fontSize: 11, fontWeight: '600', color: '#6B7280', letterSpacing: 1, marginTop: 24, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', backgroundColor: '#FFFFFF',
  },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280', letterSpacing: 1, marginTop: 24, marginBottom: 12 },

  btnPrimary: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  btnSecondary: { backgroundColor: '#EFF6FF', borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  btnSecondaryText: { fontSize: 15, color: '#2563EB', fontWeight: '600' },

  howCard: { marginTop: 32, padding: 16, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  howTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 8 },
  howLine: { fontSize: 13, color: '#4B5563', marginBottom: 4 },

  ipBox: { marginTop: 16, padding: 20, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center' },
  ipLabel: { color: '#BFDBFE', fontSize: 11, fontWeight: '600', letterSpacing: 1, textAlign: 'center' },
  ipValue: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginTop: 8 },

  playerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8,
  },
  playerName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  youBadge: { fontSize: 11, fontWeight: '600', color: '#2563EB', letterSpacing: 0.5 },
  botBadge: { fontSize: 11, fontWeight: '600', color: '#92400E', letterSpacing: 0.5, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  btnGhost: { backgroundColor: 'transparent', borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#2563EB', borderStyle: 'dashed' },
  btnGhostText: { fontSize: 14, color: '#2563EB', fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },

  errBox: { flex: 1, padding: 20, backgroundColor: '#FEF2F2' },
  errTitle: { fontSize: 18, fontWeight: '700', color: '#B91C1C', marginBottom: 8 },
  errText: { fontSize: 13, color: '#7F1D1D', marginBottom: 24, lineHeight: 19 },
  errInline: { padding: 12, marginTop: 12, borderRadius: 8, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5' },
  errInlineText: { fontSize: 13, color: '#7F1D1D' },

  foundRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#2563EB',
    marginBottom: 10,
  },
  foundNick: { fontSize: 16, fontWeight: '700', color: '#111827' },
  foundIp: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  foundArrow: { fontSize: 20, color: '#2563EB', fontWeight: '700' },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { color: '#9CA3AF', fontSize: 12, marginHorizontal: 12, fontWeight: '500' },
});
