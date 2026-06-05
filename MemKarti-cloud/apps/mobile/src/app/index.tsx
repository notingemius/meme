// DEBUG step 10: only ScrollView (no TextInput, no TouchableOpacity).
// If orange -> ScrollView OK, killer is TextInput or TouchableOpacity Fabric.
// If still broken -> ScrollView Fabric is the bug.
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

console.log('[MK-DEBUG] index.tsx (step10): module loaded');

export default function HomeScreen() {
  console.log('[MK-DEBUG] HomeScreen (step10): render start');
  const insets = useSafeAreaInsets();
  console.log('[MK-DEBUG] HomeScreen (step10): about to return JSX');
  return (
    <View style={{ flex: 1, backgroundColor: '#FF8800', paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' }}>
          STEP 10: only ScrollView (no input, no button)
        </Text>
      </ScrollView>
    </View>
  );
}
