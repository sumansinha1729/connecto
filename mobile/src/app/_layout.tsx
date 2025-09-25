import { DarkTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { CallManager } from '@/components/calls/CallManager';
import { selectIsLoggedIn, selectProfileComplete, useAuthStore } from '@/store/authStore';
import { bindRealtimeToStores } from '@/store/bindings';
import { useCallStore } from '@/store/callStore';
import { useWalletStore } from '@/store/walletStore';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootLayout() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const profileComplete = useAuthStore(selectProfileComplete);

  useEffect(() => bindRealtimeToStores(), []);

  useEffect(() => {
    if (hydrated) SplashScreen.hide();
  }, [hydrated]);

  // Load fresh account data after login / app start, and clear it on logout
  useEffect(() => {
    if (!hydrated) return;
    if (isLoggedIn) {
      useAuthStore.getState().refreshMe();
      useWalletStore.getState().refresh().catch(() => {});
    } else {
      useWalletStore.getState().reset();
      useCallStore.getState().reset();
    }
  }, [hydrated, isLoggedIn]);

  if (!hydrated) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={!isLoggedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={isLoggedIn && !profileComplete}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>

        <Stack.Protected guard={isLoggedIn && profileComplete}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="user/[id]" />
          <Stack.Screen name="match" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen
            name="call"
            options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: false }}
          />
          <Stack.Screen name="room/[id]" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="room/create" options={{ presentation: 'modal' }} />
          <Stack.Screen name="recharge" options={{ presentation: 'modal' }} />
          <Stack.Screen name="report/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="favorites" />
          <Stack.Screen name="blocked" />
        </Stack.Protected>
      </Stack>
      {isLoggedIn && <CallManager />}
    </ThemeProvider>
  );
}
