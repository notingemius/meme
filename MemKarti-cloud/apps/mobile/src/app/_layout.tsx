/**
 * This file is customizable BUT — do not remove:
 *   • `<AuthModal />` render (shipped v2 auth modal; removing it breaks
 *     signin/signup since useAuth().signIn() only flips state, not render)
 *   • `useAuth().initiate()` + `isReady` gate (loads persisted session from
 *     SecureStore — removing causes user to appear signed-out on app launch)
 *
 * Safe to change: the Stack routes, QueryClient config, splash behavior, the
 * wrapping providers, or to add nested providers around <Stack>.
 */
'use client';

import { ErrorBoundary } from '@/__create/ErrorBoundary';
import { useAuth } from '@/utils/auth/useAuth';
import { AuthModal } from '@/utils/auth/useAuthModal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
void SplashScreen.preventAutoHideAsync();

// DEBUG: marker that the _layout.tsx module was loaded by metroRequire
console.log('[MK-DEBUG] _layout.tsx module loaded');

const SPLASH_TIMEOUT_MS = 10_000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  console.log('[MK-DEBUG] RootLayout: render start');
  const { initiate } = useAuth();
  console.log('[MK-DEBUG] RootLayout: useAuth() returned');

  // Завантажуємо збережену сесію у фоні (для онлайн-режиму).
  useEffect(() => {
    console.log('[MK-DEBUG] RootLayout: calling initiate()');
    try {
      initiate();
      console.log('[MK-DEBUG] RootLayout: initiate() returned');
    } catch (e) {
      console.log('[MK-DEBUG] RootLayout: initiate() THREW', String(e));
    }
  }, [initiate]);

  // ВАЖЛИВО (фікс білого екрану / splash-hold): splash тримається нативним
  // OnPreDrawListener доти, доки JS не викличе hideAsync(). Раніше hideAsync
  // був прив'язаний до auth-гейту (isReady), і якщо рендер не доходив до нього —
  // застосунок назавжди лишався на білому splash. Тепер ховаємо splash одразу
  // після монтування root-лейаута, незалежно від auth/шрифтів.
  useEffect(() => {
    let cancelled = false;
    const hide = () => {
      console.log('[MK-DEBUG] RootLayout: calling SplashScreen.hideAsync()');
      SplashScreen.hideAsync()
        .then(() => console.log('[MK-DEBUG] SplashScreen.hideAsync resolved'))
        .catch((e) => console.log('[MK-DEBUG] SplashScreen.hideAsync rejected', String(e)));
    };
    // Невелика затримка, щоб перший кадр UI встиг змонтуватися.
    const t = setTimeout(() => {
      if (!cancelled) hide();
    }, 50);
    // Підстраховка на випадок, якщо setTimeout не спрацював.
    const t2 = setTimeout(() => {
      if (!cancelled) hide();
    }, SPLASH_TIMEOUT_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, []);

  // DEBUG (step 4): повертаємо Stack але рендеримо тривіальний index екран.
  // Для цього в commit'і також змінено app/index.tsx → простий View+Text.
  // Якщо запрацює — проблема в HomeScreen (KeyboardAvoidingAnimatedView /
  // lucide-react-native / useSafeAreaInsets / useFonts). Якщо ні — react-native-screens.
  console.log('[MK-DEBUG] RootLayout: about to return Stack with trivial index');
  return <Stack screenOptions={{ headerShown: false }} />;

  // eslint-disable-next-line no-unreachable
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
            <Stack.Screen name="index" />
            <Stack.Screen name="lobby/[code]" />
            <Stack.Screen name="game/[code]" />
          </Stack>
          <AuthModal />
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
