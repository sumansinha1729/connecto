import { API_URL } from '@/constants/env';
import type { AuthTokens } from '@/types';
import { ApiError, type ApiErrorCode } from '@/utils/errors';
import { session } from '../session';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type QueryValue = string | number | boolean | null | undefined;

interface RequestOptions {
  body?: unknown;
  /** Send as-is (e.g. an audio Blob) instead of JSON */
  rawBody?: Blob;
  headers?: Record<string, string>;
  query?: Record<string, QueryValue>;
  /** Send the access token and refresh it on 401 (default true) */
  auth?: boolean;
}

const BASE = `${API_URL}/api/v1`;

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const params = Object.entries(query ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== false && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return `${BASE}${path}${params.length ? `?${params.join('&')}` : ''}`;
}

const networkError = () =>
  new ApiError('NETWORK', 'Can’t reach the server. Check your internet connection and try again.');

// ---------- Token refresh (one at a time, shared by concurrent requests) ----------

type RefreshResult = 'ok' | 'expired' | 'network';
let refreshing: Promise<RefreshResult> | null = null;

export function refreshTokens(): Promise<RefreshResult> {
  refreshing ??= (async (): Promise<RefreshResult> => {
    const refreshToken = session.getRefreshToken();
    if (!refreshToken) return 'expired';
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return 'expired';
      const data = (await res.json()) as AuthTokens;
      session.tokensRefreshed({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return 'ok';
    } catch {
      // Offline: keep the session, the next request will try again
      return 'network';
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

// ---------- Requests ----------

export async function request<T>(
  method: Method,
  path: string,
  { body, rawBody, headers = {}, query, auth = true }: RequestOptions = {},
): Promise<T> {
  const url = buildUrl(path, query);
  const send = () => {
    const token = auth ? session.getAccessToken() : null;
    return fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers,
      },
      body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  };

  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && auth && session.getRefreshToken()) {
      const refreshed = await refreshTokens();
      if (refreshed === 'ok') res = await send();
      else if (refreshed === 'network') throw networkError();
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw networkError();
  }

  if (res.status === 401 && auth) session.expired();
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { code?: ApiErrorCode; message?: string } } | null)?.error;
    throw new ApiError(err?.code ?? 'UNKNOWN', err?.message ?? `Something went wrong (${res.status}). Please try again.`);
  }
  return data as T;
}

export const http = {
  get: <T>(path: string, query?: Record<string, QueryValue>) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('POST', path, { body: body ?? {}, ...options }),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
  /** PUT a file (e.g. a recording) with its own content type */
  upload: <T>(path: string, blob: Blob, contentType: string, headers: Record<string, string> = {}) =>
    request<T>('PUT', path, { rawBody: blob, headers: { 'Content-Type': contentType, ...headers } }),
};
