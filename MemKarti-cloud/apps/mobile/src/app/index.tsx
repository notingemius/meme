// DEBUG step 7: повний _layout + ПРОСТИЙ index. Якщо помаранчевий екран
// з'явиться — значить _layout повністю працює, а проблема в одному з
// нативних компонентів в оригінальному HomeScreen (ScrollView Fabric /
// TextInput Fabric / lucide+svg / KeyboardAvoidingView Fabric).
import { View, Text } from 'react-native';

console.log('[MK-DEBUG] index.tsx (minimal): module loaded');

export default function HomeScreen() {
  console.log('[MK-DEBUG] HomeScreen (minimal): render');
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FF8800',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' }}>
        MINIMAL HOME SCREEN
      </Text>
    </View>
  );
}
