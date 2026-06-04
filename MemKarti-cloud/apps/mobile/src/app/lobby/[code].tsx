import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { Copy, Users, Crown, ArrowLeft, Gavel, Vote, Play, Share2, Bot } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

type Player = {
  id: number;
  nickname: string;
  score: number;
  avatar_color: string;
  is_active: boolean;
  is_bot: boolean;
};

type RoomState = {
  room: {
    id: number;
    code: string;
    status: string;
    mode: string;
    language: string;
    target_score: number;
    host_player_id: number;
  };
  players: Player[];
};

export default function LobbyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string; playerId: string }>();
  const code = String(params.code || '').toUpperCase();
  const playerId = parseInt(String(params.playerId || ''), 10);

  const [state, setState] = useState<RoomState | null>(null);
  const [starting, setStarting] = useState(false);
  const [addingBot, setAddingBot] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${code}/state?playerId=${playerId}`);
      if (!res.ok) return;
      const data = await res.json();
      setState(data);
      // If game started — navigate to game screen
      if (data.room.status !== 'lobby') {
        router.replace({
          pathname: '/game/[code]',
          params: { code, playerId: String(playerId) },
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, [code, playerId, router]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const isHost = state?.room.host_player_id === playerId;
  const minPlayers = state?.room.mode === 'judge' ? 3 : 2;

  const updateSettings = async (
    patch: Partial<{ mode: string; language: string; targetScore: number }>
  ) => {
    try {
      await fetch(`/api/rooms/${code}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, ...patch }),
      });
      fetchState();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Скопійовано!', `Код кімнати: ${code}`);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Приєднуйся до мене у Memocards! Код кімнати: ${code}`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleStart = async () => {
    if (!state) return;
    const active = state.players.filter((p) => p.is_active).length;
    const need = state.room.mode === 'judge' ? 3 : 2;
    if (active < need) {
      Alert.alert('Замало гравців', `Потрібно мінімум ${need} гравці`);
      return;
    }
    setStarting(true);
    try {
      const res = await fetch(`/api/rooms/${code}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Не вдалось почати');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e.message);
    } finally {
      setStarting(false);
    }
  };

  const handleLeave = async () => {
    try {
      await fetch(`/api/rooms/${code}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
    } catch (e) {
      console.error(e);
    }
    router.replace('/');
  };

  const handleAddBot = async () => {
    setAddingBot(true);
    try {
      const res = await fetch(`/api/rooms/${code}/bot-tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add' }),
      });
      if (!res.ok) throw new Error('Не вдалось');
      fetchState();
    } catch (e) {
      console.error(e);
    } finally {
      setAddingBot(false);
    }
  };

  if (!fontsLoaded || !state) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color="#2563EB" />
      </View>
    );
  }

  const { room, players } = state;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
          }}
        >
          <TouchableOpacity
            onPress={handleLeave}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={20} color="#6B7280" />
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: '#6B7280' }}>
              Вийти
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShare}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#EFF6FF',
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Share2 size={14} color="#2563EB" />
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: '#2563EB' }}>
              Поділитись
            </Text>
          </TouchableOpacity>
        </View>

        {/* Room code card */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            padding: 24,
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 12,
              color: '#6B7280',
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            КОД КІМНАТИ
          </Text>
          <Text
            style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 42,
              color: '#111827',
              letterSpacing: 6,
            }}
          >
            {code}
          </Text>
          <TouchableOpacity
            onPress={handleCopy}
            style={{
              marginTop: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Copy size={14} color="#374151" />
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: '#374151' }}>
              Копіювати
            </Text>
          </TouchableOpacity>
        </View>

        {/* Settings section (host only or read-only for others) */}
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 12,
              color: '#6B7280',
              marginBottom: 10,
              letterSpacing: 0.5,
            }}
          >
            НАЛАШТУВАННЯ
          </Text>

          {/* Mode toggle */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <TouchableOpacity
              disabled={!isHost}
              onPress={() => updateSettings({ mode: 'judge' })}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: room.mode === 'judge' ? '#2563EB' : '#E5E7EB',
                backgroundColor: room.mode === 'judge' ? '#EFF6FF' : '#FFFFFF',
                borderRadius: 8,
                padding: 14,
              }}
            >
              <Gavel size={18} color={room.mode === 'judge' ? '#2563EB' : '#6B7280'} />
              <Text
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 14,
                  color: room.mode === 'judge' ? '#2563EB' : '#111827',
                  marginTop: 8,
                }}
              >
                Суддя
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter_400Regular',
                  fontSize: 12,
                  color: '#6B7280',
                  marginTop: 2,
                }}
              >
                Один обирає
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!isHost}
              onPress={() => updateSettings({ mode: 'vote' })}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: room.mode === 'vote' ? '#2563EB' : '#E5E7EB',
                backgroundColor: room.mode === 'vote' ? '#EFF6FF' : '#FFFFFF',
                borderRadius: 8,
                padding: 14,
              }}
            >
              <Vote size={18} color={room.mode === 'vote' ? '#2563EB' : '#6B7280'} />
              <Text
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 14,
                  color: room.mode === 'vote' ? '#2563EB' : '#111827',
                  marginTop: 8,
                }}
              >
                Голосування
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter_400Regular',
                  fontSize: 12,
                  color: '#6B7280',
                  marginTop: 2,
                }}
              >
                Всі голосують
              </Text>
            </TouchableOpacity>
          </View>

          {/* Language toggle */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <TouchableOpacity
              disabled={!isHost}
              onPress={() => updateSettings({ language: 'ua' })}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: room.language === 'ua' ? '#2563EB' : '#E5E7EB',
                backgroundColor: room.language === 'ua' ? '#EFF6FF' : '#FFFFFF',
                borderRadius: 8,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 14,
                  color: room.language === 'ua' ? '#2563EB' : '#111827',
                }}
              >
                🇺🇦 Українська
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!isHost}
              onPress={() => updateSettings({ language: 'ru' })}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: room.language === 'ru' ? '#2563EB' : '#E5E7EB',
                backgroundColor: room.language === 'ru' ? '#EFF6FF' : '#FFFFFF',
                borderRadius: 8,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 14,
                  color: room.language === 'ru' ? '#2563EB' : '#111827',
                }}
              >
                🇷🇺 Русский
              </Text>
            </TouchableOpacity>
          </View>

          {/* Target score */}
          <View style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 14 }}>
            <Text
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 12,
                color: '#6B7280',
                marginBottom: 8,
              }}
            >
              ОЧКІВ ДО ПЕРЕМОГИ: {room.target_score}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[3, 5, 7, 10].map((n) => (
                <TouchableOpacity
                  key={n}
                  disabled={!isHost}
                  onPress={() => updateSettings({ targetScore: n })}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: room.target_score === n ? '#2563EB' : '#E5E7EB',
                    backgroundColor: room.target_score === n ? '#EFF6FF' : '#FFFFFF',
                    borderRadius: 999,
                    paddingVertical: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Inter_600SemiBold',
                      fontSize: 14,
                      color: room.target_score === n ? '#2563EB' : '#111827',
                    }}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Players list */}
        <View style={{ marginBottom: 24 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 12,
                color: '#6B7280',
                letterSpacing: 0.5,
              }}
            >
              ГРАВЦІ
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Add Bot button — host only, only if no bot yet */}
              {isHost && !players.some((p) => p.is_bot && p.is_active) && (
                <TouchableOpacity
                  onPress={handleAddBot}
                  disabled={addingBot}
                  style={{
                    backgroundColor: '#F3F4F6',
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {addingBot ? (
                    <ActivityIndicator size="small" color="#374151" />
                  ) : (
                    <>
                      <Bot size={12} color="#374151" />
                      <Text
                        style={{
                          fontFamily: 'Inter_500Medium',
                          fontSize: 12,
                          color: '#374151',
                        }}
                      >
                        + Бот
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Users size={12} color="#6B7280" />
                <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#374151' }}>
                  {players.filter((p) => p.is_active).length} / 10
                </Text>
              </View>
            </View>
          </View>

          <View
            style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, overflow: 'hidden' }}
          >
            {players
              .filter((p) => p.is_active)
              .map((p, idx) => (
                <View
                  key={p.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    borderBottomWidth:
                      idx < players.filter((pl) => pl.is_active).length - 1 ? 1 : 0,
                    borderBottomColor: '#E5E7EB',
                    backgroundColor: p.id === playerId ? '#F9FAFB' : '#FFFFFF',
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      backgroundColor: p.avatar_color,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}
                  >
                    {p.is_bot ? (
                      <Bot size={18} color="#FFFFFF" />
                    ) : (
                      <Text
                        style={{
                          fontFamily: 'Inter_600SemiBold',
                          fontSize: 14,
                          color: '#FFFFFF',
                        }}
                      >
                        {p.nickname.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: 'Inter_500Medium',
                      fontSize: 15,
                      color: '#111827',
                    }}
                  >
                    {p.nickname}
                    {p.id === playerId && (
                      <Text style={{ color: '#6B7280', fontFamily: 'Inter_400Regular' }}>
                        {' '}
                        (ти)
                      </Text>
                    )}
                  </Text>
                  {p.is_bot && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: '#F3F4F6',
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        marginRight: 6,
                      }}
                    >
                      <Text
                        style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#374151' }}
                      >
                        Бот
                      </Text>
                    </View>
                  )}
                  {room.host_player_id === p.id && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#E5E7EB',
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                      }}
                    >
                      <Crown size={12} color="#EA580C" />
                      <Text
                        style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#374151' }}
                      >
                        Хост
                      </Text>
                    </View>
                  )}
                </View>
              ))}
          </View>
        </View>

        {/* Start button (host only) */}
        {isHost ? (
          <TouchableOpacity
            onPress={handleStart}
            disabled={starting || players.filter((p) => p.is_active).length < minPlayers}
            style={{
              backgroundColor:
                players.filter((p) => p.is_active).length < minPlayers ? '#9CA3AF' : '#2563EB',
              borderRadius: 8,
              paddingVertical: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: starting ? 0.6 : 1,
            }}
          >
            {starting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Play size={18} color="#FFFFFF" />
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#FFFFFF' }}>
                  {players.filter((p) => p.is_active).length < minPlayers
                    ? `Потрібно ще ${minPlayers - players.filter((p) => p.is_active).length} ${minPlayers - players.filter((p) => p.is_active).length === 1 ? 'гравця' : 'гравців'}`
                    : 'Почати гру'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View
            style={{
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 8,
              paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: '#6B7280' }}>
              Чекаємо на хоста...
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
