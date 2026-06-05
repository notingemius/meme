// DEBUG step 9: tests ScrollView + TextInput + TouchableOpacity (Fabric).
// NO icons, NO useFonts, NO StatusBar, NO KAAV.
// If orange -> these RN primitives work in Fabric, the killer is one of the
// removed: KAAV/icons/StatusBar/fontFamily references.
// If white -> a Fabric impl of ScrollView/TextInput/TouchableOpacity is the bug.
import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

console.log('[MK-DEBUG] index.tsx (step9): module loaded');

export default function HomeScreen() {
  console.log('[MK-DEBUG] HomeScreen (step9): render start');
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [val, setVal] = useState('');
  console.log('[MK-DEBUG] HomeScreen (step9): about to return JSX');

  return (
    <View style={{ flex: 1, backgroundColor: '#FF8800', paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
          STEP 9: ScrollView + TextInput + TouchableOpacity
        </Text>
        <TextInput
          value={val}
          onChangeText={setVal}
          placeholder="type here"
          placeholderTextColor="#FFE0B0"
          style={{
            backgroundColor: '#FFFFFF',
            color: '#000000',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
          }}
        />
        <TouchableOpacity
          onPress={() => router.push('/wifi')}
          style={{ backgroundColor: '#FFFFFF', padding: 16, borderRadius: 8 }}
        >
          <Text style={{ color: '#FF8800', fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
            TAP — go to /wifi
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
