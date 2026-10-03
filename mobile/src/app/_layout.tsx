import { DarkTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { CallManager } from '@/components/calls/CallManager';
import { DialogHost } from '@/components/ui';
import { VoiceManager } from '@/components/voice/VoiceManager';
import { api } from '@/services';
import {
  selectIsAdmin,
  selectIsListener,
  selectIsLoggedIn,
  selectIsPendingApplicant,
  selectProfileComplete,
  useAuthStore,
} from '@/store/authStore';
import { bindRealtimeToStores } from '@/store/bindings';
import { useCallStore } from '@/store/callStore';
import { useEarningsStore } from '@/store/earningsStore';
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
  const isListener = useAuthStore(selectIsListener);
  const isPendingApplicant = useAuthStore(selectIsPendingApplicant);
  // Admin numbers only get the "use the admin panel" screen, never the user app
  const isAdmin = useAuthStore(selectIsAdmin);
  const isMember = isLoggedIn && !isAdmin;
  const inApp = isMember && profileComplete && !isPendingApplicant;

  useEffect(() => bindRealtimeToStores(), []);

  useEffect(() => {
    if (hydrated) SplashScreen.hide();
  }, [hydrated]);

  // While logged in: keep the live connection open (it's also what makes you "online"),
  // and load fresh account data. On logout, close it and clear everything.
  useEffect(() => {
    if (!hydrated) return;
    if (isLoggedIn) {
      useAuthStore.getState().refreshMe();
      // Admins don't go online, take calls or have a wallet in the app
      if (!isAdmin) {
        api.connection.connect();
        useWalletStore.getState().refresh().catch(() => {});
      } else {
        api.connection.disconnect();
      }
    } else {
      api.connection.disconnect();
      useWalletStore.getState().reset();
      useEarningsStore.getState().reset();
      useCallStore.getState().reset();
    }
  }, [hydrated, isLoggedIn, isAdmin]);

  // Listener earnings load as soon as the account is (or becomes) a listener
  useEffect(() => {
    if (isListener) useEarningsStore.getState().refresh().catch(() => {});
  }, [isListener]);

  if (!hydrated) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={!isLoggedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={isLoggedIn && isAdmin}>
          <Stack.Screen name="admin-account" />
        </Stack.Protected>

        <Stack.Protected guard={isMember && !profileComplete}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>

        {/* Chose "become a listener" at signup: wait for the review */}
        <Stack.Protected guard={isMember && profileComplete && isPendingApplicant}>
          <Stack.Screen name="application" />
        </Stack.Protected>

        <Stack.Protected guard={inApp}>
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
          <Stack.Screen name="payout-method" options={{ presentation: 'modal' }} />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="favorites" />
          <Stack.Screen name="blocked" />
        </Stack.Protected>

        {/* Apply / edit an application: from Profile (users) or the review screen (applicants) */}
        <Stack.Protected guard={isMember && profileComplete && !isListener}>
          <Stack.Screen name="listener-apply" options={{ presentation: 'modal' }} />
        </Stack.Protected>

      </Stack>
      {inApp && <CallManager />}
      {inApp && <VoiceManager />}
      <DialogHost />
    </ThemeProvider>
  );
}
