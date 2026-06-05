// DEBUG step 4: trivial home screen. Якщо це відрендериться — оригінальний
// HomeScreen падає на чомусь (KeyboardAvoidingAnimatedView / lucide / fonts).
// Якщо НЕ відрендериться — react-native-screens падає в нативі.
import { View, Text } from 'react-native';

console.log('[MK-DEBUG] index.tsx module loaded');

export default function HomeScreenDebug() {
  console.log('[MK-DEBUG] HomeScreenDebug: render');
  return (
    <View style={{ flex: 1, backgroundColor: '#3498DB', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' }}>
        TRIVIAL INDEX SCREEN
      </Text>
    </View>
  );
}
