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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
void SplashScreen.preventAutoHideAsync();

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
  const { initiate } = useAuth();

  // Завантажуємо збережену сесію у фоні (для онлайн-режиму).
  useEffect(() => {
    initiate();
  }, [initiate]);

  // ВАЖЛИВО (фікс білого екрану / splash-hold): splash тримається нативним
  // OnPreDrawListener доти, доки JS не викличе hideAsync(). Раніше hideAsync
  // був прив'язаний до auth-гейту (isReady), і якщо рендер не доходив до нього —
  // застосунок назавжди лишався на білому splash. Тепер ховаємо splash одразу
  // після монтування root-лейаута, незалежно від auth/шрифтів.
  useEffect(() => {
    let cancelled = false;
    const hide = () => {
      SplashScreen.hideAsync().catch(() => {
        // splash вже сховано або модуль недоступний — ігноруємо
      });
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

  // НЕ блокуємо рендер на auth-гейті: головний екран не використовує сесію,
  // тож рендеримо UI одразу. Сесія підвантажиться у фоні (isReady в useAuth).
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
