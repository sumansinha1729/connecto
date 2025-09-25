import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { api, session } from '@/services';
import type { Me, ProfileUpdate } from '@/types';
import { ApiError } from '@/utils/errors';

interface AuthState {
  token: string | null;
  user: Me | null;
  /** True once the persisted session has been loaded from storage */
  hydrated: boolean;
  signIn: (token: string, user: Me) => void;
  refreshMe: () => Promise<void>;
  updateProfile: (update: ProfileUpdate) => Promise<Me>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      hydrated: false,

      signIn: (token, user) => {
        session.setToken(token);
        set({ token, user });
      },

      refreshMe: async () => {
        if (!get().token) return;
        try {
          set({ user: await api.users.getMe() });
        } catch (error) {
          if (error instanceof ApiError && error.code === 'UNAUTHORIZED') await get().logout();
        }
      },

      updateProfile: async (update) => {
        const user = await api.users.updateProfile(update);
        set({ user });
        return user;
      },

      logout: async () => {
        try {
          await api.auth.logout();
        } finally {
          session.setToken(null);
          set({ token: null, user: null });
        }
      },

      deleteAccount: async () => {
        await api.users.deleteAccount();
        session.setToken(null);
        set({ token: null, user: null });
      },
    }),
    {
      name: 'connecto.auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ token, user }) => ({ token, user }),
      onRehydrateStorage: () => (state) => {
        session.setToken(state?.token ?? null);
        useAuthStore.setState({ hydrated: true });
      },
    },
  ),
);

export const selectIsLoggedIn = (s: AuthState) => Boolean(s.token && s.user);
export const selectProfileComplete = (s: AuthState) => Boolean(s.user?.profileComplete);
