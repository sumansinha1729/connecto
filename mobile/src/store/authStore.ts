import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { api, session } from '@/services';
import type { AuthTokens, ListenerApplicationInput, Me, ProfileUpdate } from '@/types';
import { ApiError } from '@/utils/errors';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: Me | null;
  /** True once the persisted session has been loaded from storage */
  hydrated: boolean;
  signIn: (tokens: AuthTokens, user: Me) => void;
  refreshMe: () => Promise<void>;
  updateProfile: (update: ProfileUpdate) => Promise<Me>;
  setIntent: (intent: 'user' | 'listener') => Promise<Me>;
  uploadVoiceIntro: (uri: string, durationSec: number) => Promise<Me>;
  submitListenerApplication: (input: ListenerApplicationInput) => Promise<Me>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const signedOut = { accessToken: null, refreshToken: null, user: null };

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...signedOut,
      hydrated: false,

      signIn: (tokens, user) => {
        session.setTokens(tokens);
        set({ ...tokens, user });
      },

      refreshMe: async () => {
        if (!get().accessToken) return;
        try {
          set({ user: await api.users.getMe() });
        } catch (error) {
          if (error instanceof ApiError && error.code === 'UNAUTHORIZED') clearSession();
        }
      },

      updateProfile: async (update) => {
        const user = await api.users.updateProfile(update);
        set({ user });
        return user;
      },

      setIntent: async (intent) => {
        const user = await api.users.setIntent(intent);
        set({ user });
        return user;
      },

      uploadVoiceIntro: async (uri, durationSec) => {
        const user = await api.users.uploadVoiceIntro(uri, durationSec);
        set({ user });
        return user;
      },

      submitListenerApplication: async (input) => {
        const user = await api.users.submitListenerApplication(input);
        set({ user });
        return user;
      },

      logout: async () => {
        try {
          await api.auth.logout();
        } finally {
          clearSession();
        }
      },

      deleteAccount: async () => {
        await api.users.deleteAccount();
        clearSession();
      },
    }),
    {
      name: 'connecto.auth',
      // v2: access + refresh tokens. Older saved logins are dropped (log in again once)
      version: 2,
      migrate: () => ({ ...signedOut }),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ accessToken, refreshToken, user }) => ({ accessToken, refreshToken, user }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken && state.refreshToken) {
          session.setTokens({ accessToken: state.accessToken, refreshToken: state.refreshToken });
        }
        useAuthStore.setState({ hydrated: true });
      },
    },
  ),
);

function clearSession() {
  session.setTokens(null);
  useAuthStore.setState(signedOut);
}

// Keep the persisted tokens in sync with the HTTP client
session.onTokensRefreshed((tokens) => useAuthStore.setState(tokens));
session.onExpired(clearSession);

export const selectIsLoggedIn = (s: AuthState) => Boolean(s.accessToken && s.user);
export const selectProfileComplete = (s: AuthState) => Boolean(s.user?.profileComplete);
/** Admin accounts don't use the app; they use the admin web panel */
export const selectIsAdmin = (s: AuthState) => Boolean(s.user?.isAdmin);
/** An approved listener account (receives calls, earns ₹) */
export const selectIsListener = (s: AuthState) => s.user?.role === 'listener' && s.user.listenerStatus === 'approved';
/** Chose "become a listener" at signup and isn't approved yet: only the review screen is available */
export const selectIsPendingApplicant = (s: AuthState) =>
  s.user?.signupIntent === 'listener' && s.user.listenerStatus !== 'approved';
