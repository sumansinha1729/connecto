/**
 * Talks to the Connecto server. Keeps the admin's session (tokens) in localStorage,
 * refreshes the short-lived access token automatically, and logs out when the
 * session can't be renewed.
 */
import type { AdminMe } from './types';

/**
 * The server address. In development, when VITE_API_URL isn't set, use port 4050 on the same
 * computer this page came from, so it works on the Mac (localhost) and from a phone on the
 * same network (the Mac's IP). Production builds set VITE_API_URL, e.g. https://api.<domain>.
 */
const sameHost = `${window.location.protocol}//${window.location.hostname}:4050`;
export const API_URL = (import.meta.env.VITE_API_URL || sameHost).replace(/\/+$/, '');

const STORAGE_KEY = 'connecto-admin-session';

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: AdminMe;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// ---------- Session store ----------

function load(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

let session: Session | null = load();
const listeners = new Set<() => void>();

export const sessionStore = {
  get: () => session,
  set(next: Session | null) {
    session = next;
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private mode etc.: the session just won't survive a reload
    }
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

// ---------- Requests ----------

type Query = Record<string, string | number | boolean | undefined | null>;

async function send(method: string, path: string, body?: unknown, query?: Query, token?: string): Promise<Response> {
  const url = new URL(`${API_URL}/api/v1${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  try {
    return await fetch(url, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', `Can’t reach the server at ${API_URL}. Is it running?`);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code ?? 'ERROR', data?.error?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

/** One refresh at a time, even if many requests hit an expired token together */
let refreshing: Promise<boolean> | null = null;

function refreshTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    const current = sessionStore.get();
    if (!current) return false;
    try {
      const tokens = await parse<{ accessToken: string; refreshToken: string }>(
        await send('POST', '/auth/refresh', { refreshToken: current.refreshToken }),
      );
      sessionStore.set({ ...current, ...tokens });
      return true;
    } catch {
      sessionStore.set(null);
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const res = await send(method, path, body, query, sessionStore.get()?.accessToken);
  if (res.status === 401 && sessionStore.get() && (await refreshTokens())) {
    return parse<T>(await send(method, path, body, query, sessionStore.get()?.accessToken));
  }
  if (res.status === 401) sessionStore.set(null);
  return parse<T>(res);
}

export const http = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T = void>(path: string, body: unknown = {}) => request<T>('POST', path, body),
};

export async function logout() {
  const current = sessionStore.get();
  sessionStore.set(null);
  if (current) await send('POST', '/auth/logout', { refreshToken: current.refreshToken }).catch(() => {});
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong.');
