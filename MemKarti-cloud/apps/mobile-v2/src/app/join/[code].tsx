// ============================================================================
// Deep link handler: /join/:code
// ----------------------------------------------------------------------------
// When the app is opened via memkartiv2://join/ABCDE or the HTTPS equivalent,
// expo-router maps it to this route. We immediately redirect to the online
// screen with action=join and the room code.
// ============================================================================

import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function JoinByLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  useEffect(() => {
    if (code) {
      // Replace so the user cannot "go back" to this intermediate screen
      router.replace({
        pathname: '/online',
        params: { action: 'join', code: code.toUpperCase() },
      });
    }
  }, [code, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text style={styles.text}>Приєднуємось до кімнати {code?.toUpperCase()}...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  text: { marginTop: 16, fontSize: 14, color: '#6B7280' },
});
