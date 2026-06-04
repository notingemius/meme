import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  Gavel,
  Trophy,
  ArrowRight,
  Home,
  Crown,
  CheckCircle2,
  Eye,
  Sparkles,
} from 'lucide-react-native';

type Player = {
  id: number;
  nickname: string;
  score: number;
  avatar_color: string;
  is_active: boolean;
};

type HandCard = {
  hand_id: number;
  meme_id: number;
  image_url: string;
  title: string | null;
};

type Submission = {
  id: number;
  meme_card_id: number;
  image_url: string;
  title: string | null;
  votes: number;
  is_winner: boolean;
  player_id: number | null;
  nickname: string | null;
  avatar_color: string | null;
  is_my_submission: boolean;
};

type Situation = {
  id: number;
  text_ua: string;
  text_ru: string;
};

type GameState = {
  room: {
    id: number;
    code: string;
    status: string;
    mode: string;
    language: string;
    target_score: number;
    current_round: number;
    current_judge_id: number | null;
    host_player_id: number;
  };
  players: Player[];
  situation: Situation | null;
  hand: HandCard[];
  submissions: Submission[];
  hasSubmitted: boolean;
  hasVoted: boolean;
};

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2;

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string; playerId: string }>();
  const code = String(params.code || '').toUpperCase();
  const playerId = parseInt(String(params.playerId || ''), 10);

  const [state, setState] = useState<GameState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);

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
    } catch (e) {
      console.error(e);
    }
  }, [code, playerId]);

  const tickBot = useCallback(async () => {
    try {
      await fetch(`/api/rooms/${code}/bot-tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tick' }),
      });
    } catch {
      // silent — bot errors don't affect the player
    }
  }, [code]);

  useEffect(() => {
    fetchState();
    const stateInterval = setInterval(fetchState, 2000);
    const botInterval = setInterval(tickBot, 3000);
    return () => {
      clearInterval(stateInterval);
      clearInterval(botInterval);
    };
  }, [fetchState, tickBot]);

  const handleSubmit = async (memeCardId: number) => {
    if (submitting || !state) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/rooms/${code}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, memeCardId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      fetchState();
    } catch (e: any) {
      Alert.alert('Помилка', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleJudge = async (submissionId: number) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/rooms/${code}/judge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, submissionId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      fetchState();
    } catch (e: any) {
      Alert.alert('Помилка', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (submissionId: number) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/rooms/${code}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, submissionId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      fetchState();
    } catch (e: any) {
      Alert.alert('Помилка', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextRound = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch(`/api/rooms/${code}/next-round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      fetchState();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoHome = async () => {
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

  const { room, players, situation, hand, submissions, hasSubmitted, hasVoted } = state;
  const me = players.find((p) => p.id === playerId);
  const isJudge = room.current_judge_id === playerId;
  const judgePlayer = players.find((p) => p.id === room.current_judge_id);
  const situationText = room.language === 'ua' ? situation?.text_ua : situation?.text_ru;
  const submittedCount = submissions.length;
  const expectedCount =
    room.mode === 'judge'
      ? players.filter((p) => p.is_active).length - 1
      : players.filter((p) => p.is_active).length;

  // Game finished screen
  if (room.status === 'finished') {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1, justifyContent: 'center' }}>
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 999,
                backgroundColor: '#EFF6FF',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <Trophy size={40} color="#2563EB" />
            </View>
            <Text
              style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 28,
                color: '#111827',
                letterSpacing: -0.5,
              }}
            >
              Гру закінчено!
            </Text>
            <Text
              style={{
                fontFamily: 'Inter_400Regular',
                fontSize: 15,
                color: '#6B7280',
                marginTop: 8,
                textAlign: 'center',
              }}
            >
              Переможець — {winner.nickname} з {winner.score} очками
            </Text>
          </View>

          <View
            style={{
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 12,
              overflow: 'hidden',
              marginBottom: 24,
            }}
          >
            {sorted.map((p, i) => (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  borderBottomWidth: i < sorted.length - 1 ? 1 : 0,
                  borderBottomColor: '#E5E7EB',
                  backgroundColor: i === 0 ? '#F9FAFB' : '#FFFFFF',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 14,
                    color: '#6B7280',
                    width: 24,
                  }}
                >
                  {i + 1}
                </Text>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    backgroundColor: p.avatar_color,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#FFFFFF' }}>
                    {p.nickname.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text
                  style={{ flex: 1, fontFamily: 'Inter_500Medium', fontSize: 15, color: '#111827' }}
                >
                  {p.nickname}
                </Text>
                {i === 0 && <Crown size={16} color="#EA580C" style={{ marginRight: 8 }} />}
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#111827' }}>
                  {p.score}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={handleGoHome}
            style={{
              backgroundColor: '#2563EB',
              borderRadius: 8,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Home size={18} color="#FFFFFF" />
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#FFFFFF' }}>
              На головну
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar: round + scoreboard */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#374151' }}>
                Раунд {room.current_round}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Trophy size={11} color="#6B7280" />
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#374151' }}>
                До {room.target_score}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setScoreboardOpen(!scoreboardOpen)}
            style={{
              backgroundColor: '#EFF6FF',
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Eye size={12} color="#2563EB" />
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#2563EB' }}>
              Рахунок
            </Text>
          </TouchableOpacity>
        </View>

        {/* Scoreboard (collapsible) */}
        {scoreboardOpen && (
          <View
            style={{
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 12,
              overflow: 'hidden',
              marginBottom: 16,
            }}
          >
            {[...players]
              .sort((a, b) => b.score - a.score)
              .map((p, i) => (
                <View
                  key={p.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 10,
                    borderBottomWidth: i < players.length - 1 ? 1 : 0,
                    borderBottomColor: '#E5E7EB',
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      backgroundColor: p.avatar_color,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 10,
                    }}
                  >
                    <Text
                      style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#FFFFFF' }}
                    >
                      {p.nickname.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: 'Inter_500Medium',
                      fontSize: 13,
                      color: '#111827',
                    }}
                  >
                    {p.nickname}
                  </Text>
                  {room.current_judge_id === p.id && (
                    <Gavel size={12} color="#EA580C" style={{ marginRight: 6 }} />
                  )}
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#111827' }}>
                    {p.score}
                  </Text>
                </View>
              ))}
          </View>
        )}

        {/* Situation card */}
        <View
          style={{
            backgroundColor: '#111827',
            borderRadius: 16,
            padding: 24,
            marginBottom: 24,
            minHeight: 160,
            justifyContent: 'center',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Sparkles size={14} color="#9CA3AF" />
            <Text
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 11,
                color: '#9CA3AF',
                letterSpacing: 1,
              }}
            >
              СИТУАЦІЯ
            </Text>
          </View>
          <Text
            style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 22,
              color: '#FFFFFF',
              lineHeight: 30,
              letterSpacing: -0.3,
            }}
          >
            {situationText}
          </Text>
        </View>

        {/* Mode indicator */}
        {room.mode === 'judge' && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#F9FAFB',
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 8,
              padding: 12,
              marginBottom: 20,
            }}
          >
            <Gavel size={16} color="#EA580C" />
            <Text
              style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: '#374151', flex: 1 }}
            >
              {isJudge ? 'Ти суддя цього раунду' : `Суддя: ${judgePlayer?.nickname || ''}`}
            </Text>
          </View>
        )}

        {/* === PLAYING PHASE === */}
        {room.status === 'playing' && (
          <>
            {isJudge && room.mode === 'judge' ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 12,
                  padding: 24,
                  alignItems: 'center',
                }}
              >
                <Gavel size={28} color="#EA580C" />
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 16,
                    color: '#111827',
                    marginTop: 12,
                  }}
                >
                  Ти суддя
                </Text>
                <Text
                  style={{
                    fontFamily: 'Inter_400Regular',
                    fontSize: 13,
                    color: '#6B7280',
                    marginTop: 4,
                    textAlign: 'center',
                  }}
                >
                  Чекай поки інші оберуть меми ({submittedCount}/{expectedCount})
                </Text>
              </View>
            ) : hasSubmitted ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 12,
                  padding: 24,
                  alignItems: 'center',
                }}
              >
                <CheckCircle2 size={28} color="#16A34A" />
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 16,
                    color: '#111827',
                    marginTop: 12,
                  }}
                >
                  Мем обрано!
                </Text>
                <Text
                  style={{
                    fontFamily: 'Inter_400Regular',
                    fontSize: 13,
                    color: '#6B7280',
                    marginTop: 4,
                    textAlign: 'center',
                  }}
                >
                  Чекаємо на інших ({submittedCount}/{expectedCount})
                </Text>
              </View>
            ) : (
              <>
                <Text
                  style={{
                    fontFamily: 'Inter_500Medium',
                    fontSize: 12,
                    color: '#6B7280',
                    marginBottom: 12,
                    letterSpacing: 0.5,
                  }}
                >
                  ТВОЇ МЕМИ — ОБЕРИ НАЙСМІШНІШИЙ
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {hand.map((card) => (
                    <TouchableOpacity
                      key={card.hand_id}
                      onPress={() => handleSubmit(card.meme_id)}
                      disabled={submitting}
                      style={{
                        width: CARD_WIDTH,
                        borderWidth: 1,
                        borderColor: '#E5E7EB',
                        borderRadius: 12,
                        overflow: 'hidden',
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <Image
                        source={{ uri: card.image_url }}
                        style={{ width: '100%', aspectRatio: 1, backgroundColor: '#F9FAFB' }}
                        contentFit="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {/* === JUDGING / VOTING PHASE === */}
        {room.status === 'judging' && (
          <>
            <Text
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 12,
                color: '#6B7280',
                marginBottom: 12,
                letterSpacing: 0.5,
              }}
            >
              {room.mode === 'judge'
                ? isJudge
                  ? 'ОБЕРИ ПЕРЕМОЖЦЯ'
                  : 'СУДДЯ ОБИРАЄ ПЕРЕМОЖЦЯ'
                : hasVoted
                  ? 'ЧЕКАЄМО НА ІНШИХ'
                  : 'ПРОГОЛОСУЙ ЗА НАЙКРАЩИЙ'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {submissions.map((s) => {
                const canTap =
                  (room.mode === 'judge' && isJudge) ||
                  (room.mode === 'vote' && !hasVoted && !s.is_my_submission);
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => {
                      if (room.mode === 'judge') handleJudge(s.id);
                      else handleVote(s.id);
                    }}
                    disabled={!canTap || submitting}
                    style={{
                      width: CARD_WIDTH,
                      borderWidth: 1,
                      borderColor: s.is_my_submission ? '#2563EB' : '#E5E7EB',
                      borderRadius: 12,
                      overflow: 'hidden',
                      backgroundColor: '#FFFFFF',
                      opacity: canTap || s.is_my_submission ? 1 : 0.7,
                    }}
                  >
                    <Image
                      source={{ uri: s.image_url }}
                      style={{ width: '100%', aspectRatio: 1, backgroundColor: '#F9FAFB' }}
                      contentFit="cover"
                    />
                    {s.is_my_submission && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          backgroundColor: '#EFF6FF',
                          borderRadius: 999,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Text
                          style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#2563EB' }}
                        >
                          Твій
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* === RESULTS PHASE === */}
        {room.status === 'results' && (
          <>
            <Text
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 12,
                color: '#6B7280',
                marginBottom: 12,
                letterSpacing: 0.5,
              }}
            >
              РЕЗУЛЬТАТИ РАУНДУ
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
              {[...submissions]
                .sort((a, b) => (b.is_winner ? 1 : 0) - (a.is_winner ? 1 : 0))
                .map((s) => (
                  <View
                    key={s.id}
                    style={{
                      width: CARD_WIDTH,
                      borderWidth: 1,
                      borderColor: s.is_winner ? '#2563EB' : '#E5E7EB',
                      borderRadius: 12,
                      overflow: 'hidden',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <Image
                      source={{ uri: s.image_url }}
                      style={{ width: '100%', aspectRatio: 1, backgroundColor: '#F9FAFB' }}
                      contentFit="cover"
                    />
                    <View style={{ padding: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 999,
                            backgroundColor: s.avatar_color || '#9CA3AF',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: 'Inter_600SemiBold',
                              fontSize: 9,
                              color: '#FFFFFF',
                            }}
                          >
                            {s.nickname?.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontFamily: 'Inter_500Medium',
                            fontSize: 12,
                            color: '#374151',
                            flex: 1,
                          }}
                          numberOfLines={1}
                        >
                          {s.nickname}
                        </Text>
                        {s.is_winner && <Crown size={12} color="#EA580C" />}
                      </View>
                      {room.mode === 'vote' && (
                        <Text
                          style={{
                            fontFamily: 'Inter_400Regular',
                            fontSize: 11,
                            color: '#6B7280',
                            marginTop: 4,
                          }}
                        >
                          Голосів: {s.votes}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
            </View>

            <TouchableOpacity
              onPress={handleNextRound}
              disabled={submitting}
              style={{
                backgroundColor: '#2563EB',
                borderRadius: 8,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#FFFFFF' }}>
                    Наступний раунд
                  </Text>
                  <ArrowRight size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Footer: my score */}
        {me && (
          <View style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                backgroundColor: me.avatar_color,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#FFFFFF' }}>
                {me.nickname.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: '#6B7280' }}>
              {me.nickname} · {me.score} {me.score === 1 ? 'очко' : me.score < 5 ? 'очки' : 'очок'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
