// DEBUG step 11: ScrollView + TextInput (no TouchableOpacity).
// If broken -> TextInput Fabric is the killer.
// If orange -> TouchableOpacity Fabric is.
import { useState } from 'react';
import { View, Text, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

console.log('[MK-DEBUG] index.tsx (step11): module loaded');

export default function HomeScreen() {
  console.log('[MK-DEBUG] HomeScreen (step11): render start');
  const insets = useSafeAreaInsets();
  const [val, setVal] = useState('');
  console.log('[MK-DEBUG] HomeScreen (step11): about to return JSX');
  return (
    <View style={{ flex: 1, backgroundColor: '#FF8800', paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
          STEP 11: ScrollView + TextInput
        </Text>
        <TextInput
          value={val}
          onChangeText={setVal}
          placeholder="type"
          placeholderTextColor="#FFE0B0"
          style={{
            backgroundColor: '#FFFFFF',
            color: '#000000',
            padding: 12,
            borderRadius: 8,
          }}
        />
      </ScrollView>
    </View>
  );
}
