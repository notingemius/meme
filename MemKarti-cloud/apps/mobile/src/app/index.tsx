import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Sparkles, Users, Plus, LogIn, Trophy, Zap, Wifi } from 'lucide-react-native';
import KeyboardAvoidingAnimatedView from '@/components/KeyboardAvoidingAnimatedView';
// FIX (white screen): stock <TextInput> is broken under Fabric/new architecture
// in react-native 0.81.4 on Android. SafeTextInput wraps Paper's TextInput
// which uses a different native impl that works correctly.
import TextInput from '@/components/SafeTextInput';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');
  const [loading, setLoading] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // НЕ блокуємо рендер на шрифтах: якщо Inter ще не готовий — показуємо екран
  // із системним шрифтом (а не білий екран). Коли шрифт завантажиться, екран
  // перемалюється з Inter. void — щоб лінтер не лаявся на невикористану змінну.
  void fontsLoaded;

  const handleCreateRoom = async () => {
    if (!nickname.trim()) {
      Alert.alert('Введи нік', "Спочатку введи своє ім'я");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
      if (!res.ok) throw new Error('Не вдалось створити кімнату');
      const data = await res.json();
      router.push(`/lobby/${data.roomCode}?playerId=${data.playerId}`);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалось створити кімнату');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!nickname.trim() || !roomCode.trim()) {
      Alert.alert('Заповни поля', 'Введи нік і код кімнати');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          roomCode: roomCode.trim().toUpperCase(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Не вдалось приєднатись');
      }
      const data = await res.json();
      router.push(`/lobby/${data.roomCode}?playerId=${data.playerId}`);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Помилка', e.message || 'Не вдалось приєднатись');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar style="dark" />
      <KeyboardAvoidingAnimatedView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 20,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Soft Action Pill - "New" announcement */}
          <View style={{ alignItems: 'flex-start', marginBottom: 24 }}>
            <View
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
              <Sparkles size={14} color="#2563EB" />
              <Text
                style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 13,
                  color: '#2563EB',
                }}
              >
                Бета · Грай з друзями онлайн
              </Text>
            </View>
          </View>

          {/* Hero */}
          <View style={{ marginBottom: 32 }}>
            <Text
              style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 32,
                color: '#111827',
                letterSpacing: -0.5,
                lineHeight: 38,
              }}
            >
              Memocards
            </Text>
            <Text
              style={{
                fontFamily: 'Inter_400Regular',
                fontSize: 15,
                color: '#6B7280',
                marginTop: 8,
                lineHeight: 22,
              }}
            >
              Картки з ситуаціями та найсмішніші меми. Збирай друзів і дізнайся, у кого найкраще
              почуття гумору.
            </Text>
          </View>

          {/* Feature Cards Row */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                padding: 16,
              }}
            >
              <Users size={20} color="#111827" />
              <Text
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 14,
                  color: '#111827',
                  marginTop: 12,
                }}
              >
                3–10 гравців
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter_400Regular',
                  fontSize: 12,
                  color: '#6B7280',
                  marginTop: 4,
                }}
              >
                Грай із компанією
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                padding: 16,
              }}
            >
              <Trophy size={20} color="#111827" />
              <Text
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 14,
                  color: '#111827',
                  marginTop: 12,
                }}
              >
                2 режими
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter_400Regular',
                  fontSize: 12,
                  color: '#6B7280',
                  marginTop: 4,
                }}
              >
                Суддя або голосування
              </Text>
            </View>
          </View>

          {/* Form Section */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              padding: 20,
            }}
          >
            <Text
              style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 16,
                color: '#111827',
              }}
            >
              {mode === 'menu' ? 'Почати гру' : 'Приєднатись до кімнати'}
            </Text>
            <Text
              style={{
                fontFamily: 'Inter_400Regular',
                fontSize: 13,
                color: '#6B7280',
                marginTop: 4,
              }}
            >
              {mode === 'menu'
                ? 'Створи нову кімнату або приєднайся за кодом'
                : 'Введи код від друга, щоб приєднатись'}
            </Text>

            {/* Nickname input */}
            <View style={{ marginTop: 20 }}>
              <Text
                style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 12,
                  color: '#6B7280',
                  marginBottom: 6,
                }}
              >
                ТВІЙ НІК
              </Text>
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                placeholder="Наприклад: Олег"
                placeholderTextColor="#9CA3AF"
                maxLength={20}
                style={{
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 15,
                  color: '#111827',
                  backgroundColor: '#FFFFFF',
                }}
              />
            </View>

            {/* Room code input - only in join mode */}
            {mode === 'join' && (
              <View style={{ marginTop: 16 }}>
                <Text
                  style={{
                    fontFamily: 'Inter_500Medium',
                    fontSize: 12,
                    color: '#6B7280',
                    marginBottom: 6,
                  }}
                >
                  КОД КІМНАТИ
                </Text>
                <TextInput
                  value={roomCode}
                  onChangeText={(t) => setRoomCode(t.toUpperCase())}
                  placeholder="ABC123"
                  placeholderTextColor="#9CA3AF"
                  maxLength={6}
                  autoCapitalize="characters"
                  style={{
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    borderRadius: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 18,
                    color: '#111827',
                    letterSpacing: 4,
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </View>
            )}

            {/* Actions */}
            {mode === 'menu' ? (
              <View style={{ marginTop: 20, gap: 10 }}>
                <TouchableOpacity
                  onPress={handleCreateRoom}
                  disabled={loading}
                  style={{
                    backgroundColor: '#2563EB',
                    borderRadius: 8,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Plus size={18} color="#FFFFFF" />
                      <Text
                        style={{
                          fontFamily: 'Inter_600SemiBold',
                          fontSize: 15,
                          color: '#FFFFFF',
                        }}
                      >
                        Створити кімнату
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setMode('join')}
                  disabled={loading}
                  style={{
                    backgroundColor: '#EFF6FF',
                    borderRadius: 8,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <LogIn size={18} color="#2563EB" />
                  <Text
                    style={{
                      fontFamily: 'Inter_600SemiBold',
                      fontSize: 15,
                      color: '#2563EB',
                    }}
                  >
                    Приєднатись за кодом
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/wifi')}
                  disabled={loading}
                  style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EEF2FF', borderRadius: 14, paddingVertical: 16, marginTop: 12 }]}
                >
                  <Wifi size={18} color="#2563EB" />
                  <Text style={[{ color: '#2563EB', fontSize: 16, fontFamily: 'Inter_600SemiBold' }]}>
                    Рядом по Wi-Fi (офлайн)
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginTop: 20, gap: 10 }}>
                <TouchableOpacity
                  onPress={handleJoinRoom}
                  disabled={loading}
                  style={{
                    backgroundColor: '#2563EB',
                    borderRadius: 8,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Zap size={18} color="#FFFFFF" />
                      <Text
                        style={{
                          fontFamily: 'Inter_600SemiBold',
                          fontSize: 15,
                          color: '#FFFFFF',
                        }}
                      >
                        Увійти в гру
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setMode('menu');
                    setRoomCode('');
                  }}
                  disabled={loading}
                  style={{
                    paddingVertical: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Inter_500Medium',
                      fontSize: 14,
                      color: '#6B7280',
                    }}
                  >
                    ← Назад
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* How it works - hyphen list */}
          <View style={{ marginTop: 32 }}>
            <Text
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 12,
                color: '#6B7280',
                marginBottom: 12,
                letterSpacing: 0.5,
              }}
            >
              ЯК ГРАТИ
            </Text>
            {[
              'Створи кімнату або приєднайся за кодом',
              'Дочекайся друзів у лоббі',
              'Прочитай ситуацію та обери смішний мем',
              'Суддя або всі разом обирають переможця',
              'Перший до 5 очок виграє',
            ].map((line, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Inter_400Regular',
                    fontSize: 14,
                    color: '#9CA3AF',
                    marginRight: 10,
                  }}
                >
                  -
                </Text>
                <Text
                  style={{
                    fontFamily: 'Inter_400Regular',
                    fontSize: 14,
                    color: '#4B5563',
                    flex: 1,
                  }}
                >
                  {line}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingAnimatedView>
    </View>
  );
}