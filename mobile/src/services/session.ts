import type { AuthTokens } from '@/types';

/**
 * Holds the login tokens so services can attach them to requests.
 * The auth store owns persistence; the HTTP client reports refreshes and
 * expiry back through the listeners below.
 */
let tokens: AuthTokens | null = null;
const refreshedListeners = new Set<(tokens: AuthTokens) => void>();
const expiredListeners = new Set<() => void>();

export const session = {
  getAccessToken: () => tokens?.accessToken ?? null,
  getRefreshToken: () => tokens?.refreshToken ?? null,
  setTokens: (value: AuthTokens | null) => {
    tokens = value;
  },

  /** Called by the HTTP client after a successful token refresh */
  tokensRefreshed: (value: AuthTokens) => {
    tokens = value;
    refreshedListeners.forEach((listener) => listener(value));
  },
  /** Called by the HTTP client when the session can't be refreshed any more */
  expired: () => {
    tokens = null;
    expiredListeners.forEach((listener) => listener());
  },

  onTokensRefreshed: (listener: (tokens: AuthTokens) => void) => {
    refreshedListeners.add(listener);
    return () => refreshedListeners.delete(listener);
  },
  onExpired: (listener: () => void) => {
    expiredListeners.add(listener);
    return () => expiredListeners.delete(listener);
  },
};
