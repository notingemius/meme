// DEBUG step 12: TextInput WITHOUT ScrollView.
// If orange -> TextInput alone OK; bug is ScrollView+TextInput nesting.
//   Fix: don't put TextInput inside ScrollView.
// If broken -> TextInput Fabric is fundamentally broken;
//   Fix: replace TextInput with a community alternative.
import { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

console.log('[MK-DEBUG] index.tsx (step12): module loaded');

export default function HomeScreen() {
  console.log('[MK-DEBUG] HomeScreen (step12): render start');
  const insets = useSafeAreaInsets();
  const [val, setVal] = useState('');
  console.log('[MK-DEBUG] HomeScreen (step12): about to return JSX');
  return (
    <View style={{ flex: 1, backgroundColor: '#FF8800', paddingTop: insets.top, padding: 20 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        STEP 12: TextInput WITHOUT ScrollView
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
    </View>
  );
}
