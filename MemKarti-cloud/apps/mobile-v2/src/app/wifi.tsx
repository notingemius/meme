import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function WifiScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + 24,
        paddingHorizontal: 20,
        backgroundColor: '#FFFFFF',
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: '600', color: '#111827' }}>
        Wi-Fi (TODO)
      </Text>
      <Text style={{ marginTop: 12, color: '#6B7280' }}>
        Експорт логіки гри по Wi-Fi з mobile/ — наступний крок.
      </Text>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          marginTop: 24,
          paddingVertical: 14,
          backgroundColor: '#2563EB',
          borderRadius: 8,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>← Назад</Text>
      </TouchableOpacity>
    </View>
  );
}
