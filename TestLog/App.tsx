import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/theme/theme';
import type { RootStackParamList } from './src/navigation';
import MenuScreen from './src/screens/MenuScreen';
import WifiSetupScreen from './src/screens/WifiSetupScreen';
import PlayScreen from './src/screens/PlayScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          initialRouteName="Menu"
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
        >
          <Stack.Screen name="Menu" component={MenuScreen} />
          <Stack.Screen name="WifiSetup" component={WifiSetupScreen} />
          <Stack.Screen name="Play" component={PlayScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
