// ============================================================================
// Online multiplayer screen (game over the internet, by room code).
// ----------------------------------------------------------------------------
// Transport: Socket.IO to the MemKarti server (EXPO_PUBLIC_SERVER_URL).
// The server is authoritative and runs the SAME engine as solo/LAN, so this
// screen just sends actions and renders the per-player ClientView it receives
// — reusing LanGameUI exactly like the Wi-Fi (LAN) screen does.
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Share,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { io, type Socket } from 'socket.io-client';
import type { ClientView } from '@/game/lanGame';
import { LanGameUI } from '@/components/LanGameUI';
import { Avatar } from '@/components/Avatar';
import { SettingsChips } from '@/components/SettingsChips';
import { LobbyChat } from '@/components/LobbyChat';
import { SERVER_URL } from '@/config';
import { getCachedProfile, reportGameResult } from '@/game/profile';
import { useTheme } from '@/ThemeProvider';

// Lobby-facing player info mirrored from the server (rooms.ts RoomPlayerInfo).
type RoomPlayerInfo = {
  playerId: string;
  nickname: string;
  score: number;
  online: boolean;
  ready: boolean;
  isHost: boolean;
};

export default function OnlineScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{ nickname?: string; action?: string; code?: string }>();
  const nickname = (params.nickname ?? '').toString();
  const action = (params.action ?? 'create').toString(); // 'create' | 'join'
  const joinCode = (params.code ?? '').toString();

  const socketRef = useRef<Socket | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [view, setView] = useState<ClientView | null>(null);
  const [players, setPlayers] = useState<RoomPlayerInfo[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'error'>('connecting');

  // Reconnection credentials stored in memory.
  const reconnectRef = useRef<{ roomCode: string; playerId: string; token: string } | null>(null);
  // Whether we have already received the first gameState (so we show reconnecting instead of error).
  const hadConnectionRef = useRef(false);

  // --- socket lifecycle -----------------------------------------------------
  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 60000, // tolerate Render free-tier cold start (~30-50s)
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
      setErr(null);
      // If we have reconnect credentials, try to rejoin instead of creating/joining.
      const creds = reconnectRef.current;
      if (creds) {
        socket.emit('rejoinRoom', { roomCode: creds.roomCode, playerId: creds.playerId, token: creds.token });
        return;
      }
      if (action === 'join') {
        socket.emit('joinRoom', { roomCode: joinCode, nickname });
      } else {
        socket.emit('createRoom', { nickname });
      }
    });

    socket.on('connect_error', (e: Error) => {
      if (hadConnectionRef.current) {
        setStatus('reconnecting');
      } else {
        setStatus('error');
        setErr(`Не вдалось підключитись до сервера. ${e?.message ?? ''}`.trim());
      }
    });

    socket.on('roomCreated', ({ roomCode: rc, playerId, token }: { roomCode: string; playerId: string; token: string }) => {
      setRoomCode(rc);
      setMyId(playerId);
      reconnectRef.current = { roomCode: rc, playerId, token };
    });

    socket.on('roomJoined', ({ roomCode: rc, playerId, token }: { roomCode: string; playerId: string; token: string }) => {
      setRoomCode(rc);
      setMyId(playerId);
      reconnectRef.current = { roomCode: rc, playerId, token };
    });

    socket.on('roomRejoined', ({ roomCode: rc, playerId }: { roomCode: string; playerId: string }) => {
      setRoomCode(rc);
      setMyId(playerId);
    });

    socket.on(
      'gameState',
      (payload: { roomCode: string; view: ClientView; players: RoomPlayerInfo[]; isHost: boolean }) => {
        hadConnectionRef.current = true;
        setView(payload.view);
        setPlayers(payload.players);
        setIsHost(payload.isHost);
        if (payload.roomCode) setRoomCode(payload.roomCode);
      },
    );

    socket.on('errorMessage', ({ message }: { message: string }) => {
      setErr(message);
    });

    socket.on('disconnect', () => {
      if (hadConnectionRef.current) {
        setStatus('reconnecting');
      } else {
        setStatus('connecting');
      }
    });

    // Socket.IO gives up after reconnectionAttempts.
    socket.io.on('reconnect_failed', () => {
      setStatus('error');
      setErr('Не вдалось перепідключитись. Перевір з\'єднання та спробуй ще раз.');
    });

    return () => {
      socket.removeAllListeners();
      socket.io.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- report game result when finished ------------------------------------
  const reportedOnlineRef = useRef(false);
  useEffect(() => {
    if (!view || view.phase !== 'finished' || reportedOnlineRef.current) return;
    reportedOnlineRef.current = true;
    getCachedProfile().then((profile) => {
      if (!profile || !myId) return;
      const myPlayer = view.players.find((p) => p.id === myId);
      const topScore = Math.max(...view.players.map((p) => p.score));
      const won = myPlayer ? myPlayer.score === topScore : false;
      reportGameResult(profile.id, won, view.round);
    });
  }, [view, myId]);

  // --- actions --------------------------------------------------------------
  const emit = useCallback(
    (event: string, payload: Record<string, unknown> = {}) => {
      socketRef.current?.emit(event, { roomCode, ...payload });
    },
    [roomCode],
  );

  const onSubmit = useCallback((cardId: number) => emit('playCard', { cardId }), [emit]);
  const onVote = useCallback((submissionId: string) => emit('castVote', { submissionId }), [emit]);
  const onReplace = useCallback((cardId: number) => emit('replaceCard', { cardId }), [emit]);
  const onNextRound = useCallback(() => emit('nextRound'), [emit]);
  const onStart = useCallback(() => emit('startGame'), [emit]);
  const onAddBot = useCallback(() => emit('addBot'), [emit]);
  const onChat = useCallback((text: string) => emit('sendChatMessage', { text }), [emit]);
  const onChangeRounds = useCallback((n: number) => emit('updateSettings', { totalRounds: n }), [emit]);
  const onChangePickSec = useCallback((n: number) => emit('updateSettings', { pickSeconds: n }), [emit]);
  const onChangeVoteSec = useCallback((n: number) => emit('updateSettings', { voteSeconds: n }), [emit]);

  const onExit = useCallback(() => {
    emit('leaveRoom');
    socketRef.current?.disconnect();
    router.back();
  }, [emit, router]);

  const shareCode = useCallback(() => {
    if (!roomCode) return;
    Share.share({
      message: `Грай зі мною в МемКарти! Приєднуйся: ${SERVER_URL}/join/${roomCode}`,
    }).catch(() => {});
  }, [roomCode]);

  // --- render: error --------------------------------------------------------
  if (status === 'error' && !view) {
    return (
      <View style={[styles.errBox, { paddingTop: insets.top + 24, backgroundColor: colors.errorBg }]}>
        <Text style={[styles.errTitle, { color: colors.error }]}>Немає звʼязку з сервером</Text>
        <Text style={[styles.errText, { color: colors.error }]}>
          {err ?? 'Сервер недоступний.'}
          {'\n\n'}На безкоштовному тарифі сервер «засинає» — перша спроба після
          паузи може тривати 30–50 секунд. Спробуй ще раз.
        </Text>
        <TouchableOpacity onPress={onExit} style={[styles.btnSecondary, { backgroundColor: colors.btnSecondaryBg }]}>
          <Text style={[styles.btnSecondaryText, { color: colors.primaryText }]}>← На головну</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- render: reconnecting ------------------------------------------------
  if (status === 'reconnecting') {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24, backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={{ marginTop: 16, color: colors.warning, textAlign: 'center', paddingHorizontal: 32, fontWeight: '600' }}>
          Перепідключення...
        </Text>
        <Text style={{ marginTop: 8, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32, fontSize: 13 }}>
          Зʼєднання втрачено, намагаємось повернутись до гри
        </Text>
        <TouchableOpacity onPress={onExit} style={[styles.btnSecondary, { marginTop: 24, backgroundColor: colors.btnSecondaryBg }]}>
          <Text style={[styles.btnSecondaryText, { color: colors.primaryText }]}>← Вийти</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- render: connecting / waiting for first state -------------------------
  if (!view) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24, backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 }}>
          {action === 'join'
            ? `Підключаємось до кімнати ${joinCode}…`
            : 'Створюємо кімнату…'}
          {'\n'}(перший запуск сервера може зайняти ~30с)
        </Text>
        {err && <Text style={[styles.errInlineText, { color: colors.error }]}>{err}</Text>}
        <TouchableOpacity onPress={onExit} style={[styles.btnSecondary, { marginTop: 24, backgroundColor: colors.btnSecondaryBg }]}>
          <Text style={[styles.btnSecondaryText, { color: colors.primaryText }]}>← Скасувати</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- render: lobby --------------------------------------------------------
  if (view.phase === 'lobby') {
    const onlinePlayers = players.length ? players : view.players.map((p) => ({
      playerId: p.id, nickname: p.nickname, score: p.score, online: true, ready: false, isHost: p.id === 'host',
    }));
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 16 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <TouchableOpacity onPress={onExit}>
            <Text style={{ color: colors.primaryText, fontSize: 14, fontWeight: '600' }}>← Вийти</Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.text }]}>{isHost ? 'Твоя кімната' : 'В лобі'}</Text>

          {/* Room code — share with friends */}
          <TouchableOpacity onPress={shareCode} activeOpacity={0.8} style={[styles.codeBox, { backgroundColor: colors.primary }]}>
            <Text style={styles.codeLabel}>КОД КІМНАТИ (тапни щоб поділитись)</Text>
            <Text style={styles.codeValue}>{roomCode ?? '…'}</Text>
          </TouchableOpacity>

          {isHost && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>НАЛАШТУВАННЯ ГРИ</Text>
              <SettingsChips
                label="Раунди"
                emoji="🎯"
                value={view.totalRounds}
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
                value={view.pickSeconds}
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
                value={view.voteSeconds}
                options={[
                  { value: 10, label: '10с' },
                  { value: 20, label: '20с' },
                  { value: 45, label: '45с' },
                ]}
                onChange={onChangeVoteSec}
              />
            </>
          )}

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ГРАВЦІ ({onlinePlayers.length})</Text>
          {onlinePlayers.map((p) => (
            <View key={p.playerId} style={[styles.playerRow, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Avatar id={p.playerId} nickname={p.nickname} size={32} />
                <Text style={[styles.playerName, { marginLeft: 10, opacity: p.online ? 1 : 0.4, color: colors.text }]}>
                  {p.playerId.startsWith('bot') ? '🤖 ' : ''}{p.nickname}
                </Text>
                {!p.online && !p.playerId.startsWith('bot') && <Text style={[styles.offlineBadge, { color: colors.textMuted }]}>офлайн</Text>}
              </View>
              {p.playerId === myId && <Text style={[styles.youBadge, { color: colors.primary }]}>ТИ</Text>}
              {p.playerId.startsWith('bot') && <Text style={styles.botBadge}>БОТ</Text>}
              {p.isHost && <Text style={styles.hostBadge}>ХОСТ</Text>}
            </View>
          ))}

          {isHost && (
            <TouchableOpacity
              onPress={onAddBot}
              disabled={onlinePlayers.length >= 8}
              style={[styles.btnGhost, { marginTop: 8, opacity: onlinePlayers.length >= 8 ? 0.5 : 1, borderColor: colors.primary }]}
            >
              <Text style={[styles.btnGhostText, { color: colors.primaryText }]}>+ Додати бота</Text>
            </TouchableOpacity>
          )}

          {isHost ? (
            <TouchableOpacity
              onPress={onStart}
              disabled={onlinePlayers.length < 2}
              style={[styles.btnPrimary, { marginTop: 16, opacity: onlinePlayers.length < 2 ? 0.5 : 1, backgroundColor: colors.primary }]}
            >
              <Text style={styles.btnPrimaryText}>
                {onlinePlayers.length < 2 ? 'Чекаємо ще гравця (або додай бота)…' : 'Почати гру'}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.waitHint, { color: colors.textSecondary }]}>Очікуємо, поки хост почне гру…</Text>
          )}

          <LobbyChat messages={view.chat} myId={view.myId} onSend={onChat} />
        </ScrollView>
      </View>
    );
  }

  // --- render: in-game (reuse LanGameUI) ------------------------------------
  return (
    <LanGameUI
      view={view}
      insets={insets}
      isHost={isHost}
      onSubmit={onSubmit}
      onVote={onVote}
      onNextRound={onNextRound}
      onExit={onExit}
      onReplaceCard={onReplace}
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', marginTop: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginTop: 24, marginBottom: 12 },

  codeBox: { marginTop: 16, padding: 20, borderRadius: 14, alignItems: 'center' },
  codeLabel: { color: '#BFDBFE', fontSize: 11, fontWeight: '600', letterSpacing: 1, textAlign: 'center' },
  codeValue: { color: '#FFFFFF', fontSize: 36, fontWeight: '700', marginTop: 8, letterSpacing: 6 },

  playerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 8,
  },
  playerName: { fontSize: 15, fontWeight: '600' },
  offlineBadge: { fontSize: 11, marginLeft: 8, fontStyle: 'italic' },
  youBadge: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  hostBadge: { fontSize: 11, fontWeight: '600', color: '#5B21B6', letterSpacing: 0.5, backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
  botBadge: { fontSize: 11, fontWeight: '600', color: '#92400E', letterSpacing: 0.5, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
  btnGhost: { backgroundColor: 'transparent', borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed' },
  btnGhostText: { fontSize: 14, fontWeight: '600' },
  waitHint: { marginTop: 20, fontSize: 14, textAlign: 'center' },

  btnPrimary: { borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  btnSecondary: { borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginHorizontal: 20 },
  btnSecondaryText: { fontSize: 15, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errBox: { flex: 1, padding: 20 },
  errTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errText: { fontSize: 13, marginBottom: 24, lineHeight: 19 },
  errInlineText: { fontSize: 13, marginTop: 16, textAlign: 'center', paddingHorizontal: 24 },
});
