// Must stay the first import: sets the test configuration before server code loads
import { TEST_MONGO_URL } from './testEnv';

import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { io, type Socket } from 'socket.io-client';

import { connectDb, disconnectDb } from '../src/config/db';
import { setAdminByPhone } from '../src/modules/admin/admin.service';
import { sms } from '../src/modules/auth/sms';
import { startServer, type RunningServer } from '../src/server';

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- Server ----------

let running: RunningServer | null = null;
let host = '';
const sockets: Socket[] = [];

/** Server address, e.g. http://127.0.0.1:53211 */
export const serverUrl = () => host;

/** A fresh, empty database for one test file. Each file gets its own, so files can run in parallel. */
export async function startTestDb(name: string) {
  await connectDb(`${TEST_MONGO_URL}/connecto_test_${name}`);
  await mongoose.connection.dropDatabase();
  await mongoose.connection.syncIndexes();
}

export async function startTestServer(name: string) {
  await startTestDb(name);
  running = await startServer(0);
  host = `http://127.0.0.1:${running.port}`;
}

export async function stopTestServer() {
  for (const socket of sockets) socket.disconnect();
  await running?.close();
  running = null;
  await disconnectDb();
}

// ---------- Assertions ----------

/** Fails the current test with a readable message and what was actually received */
export function check(name: string, condition: unknown, received?: unknown): asserts condition {
  if (condition) return;
  const detail = received === undefined ? '' : `\n  received: ${JSON.stringify(received)?.slice(0, 800)}`;
  assert.fail(`${name}${detail}`);
}

// ---------- HTTP ----------

export interface Response<T = any> {
  status: number;
  data: T;
}

interface CallOptions {
  body?: unknown;
  token?: string;
  /** Raw request body (e.g. audio bytes) instead of JSON */
  raw?: Uint8Array<ArrayBuffer>;
  headers?: Record<string, string>;
  /** Client IP seen by the server. Random by default, so per-IP limits don't add up across tests. */
  ip?: string;
}

const randomIp = () => `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${1 + Math.floor(Math.random() * 254)}`;

export async function call<T = any>(method: string, path: string, options: CallOptions = {}): Promise<Response<T>> {
  const { body, token, raw, headers = {}, ip = randomIp() } = options;
  const res = await fetch(`${host}/api/v1${path}`, {
    method,
    headers: {
      ...(raw ? {} : { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      'X-Forwarded-For': ip,
      ...headers,
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

/** Links built by the server point at PUBLIC_BASE_URL; send them to the test server instead */
export const onTestServer = (url: string) => {
  const { pathname, search } = new URL(url);
  return `${host}${pathname}${search}`;
};

// ---------- Users ----------

/** OTP codes "sent" by SMS, by phone (E.164) */
const sentOtps = new Map<string, string>();
sms.sendOtp = async (phone, code) => {
  sentOtps.set(phone, code);
};
export const lastOtp = (phone: string) => sentOtps.get(phone);

export interface TestUser {
  token: string;
  refresh: string;
  id: string;
  /** 10 digits, as typed in the app */
  phone: string;
  name?: string;
  isNewUser: boolean;
  user: any;
  events: { event: string; payload: any; at: number }[];
  socket?: Socket;
}

/** Logs in with the dev OTP */
export async function login(phone: string): Promise<TestUser> {
  await call('POST', '/auth/otp/request', { body: { phone } });
  const { status, data } = await call('POST', '/auth/otp/verify', { body: { phone, code: '123456' } });
  check(`login ${phone}`, status === 200, data);
  return {
    token: data.accessToken,
    refresh: data.refreshToken,
    id: data.user.id,
    phone,
    isNewUser: data.isNewUser,
    user: data.user,
    events: [],
  };
}

export const basics = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  gender: 'female',
  age: 26,
  languages: ['Hindi'],
  ...extra,
});

/** A normal user with a complete profile */
export async function makeUser(phone: string, name: string, extra: Record<string, unknown> = {}): Promise<TestUser> {
  const user = await login(phone);
  const { status, data } = await call('PATCH', '/users/me', { token: user.token, body: basics(name, extra) });
  check(`profile for ${name}`, status === 200, data);
  return { ...user, name, user: data.user };
}

export async function makeAdmin(user: TestUser, isAdmin = true) {
  return setAdminByPhone(`+91${user.phone}`, isAdmin);
}

export const fakeAudio = (bytes = 4096) => new Uint8Array(bytes).fill(7);

export const uploadVoiceIntro = (token: string, durationSec = 40, contentType = 'audio/webm') =>
  call('PUT', '/users/me/voice-intro', {
    token,
    raw: fakeAudio(),
    headers: { 'Content-Type': contentType, 'X-Duration-Sec': String(durationSec) },
  });

/** The full listener path: choose listener → basics → voice intro → application → admin approval */
export async function makeListener(
  phone: string,
  name: string,
  admin: TestUser,
  { languages = ['Hindi'], gender = 'female' }: { languages?: string[]; gender?: string } = {},
): Promise<TestUser> {
  const user = await login(phone);
  await call('POST', '/users/me/intent', { token: user.token, body: { intent: 'listener' } });
  await call('PATCH', '/users/me', { token: user.token, body: { name, gender, languages } });
  await uploadVoiceIntro(user.token);
  await call('POST', '/users/me/listener-application', {
    token: user.token,
    body: { fullName: `${name} Sharma`, dateOfBirth: '1995-04-10', city: 'Pune', about: 'I enjoy listening and helping friends through tough times.' },
  });
  const { status, data } = await call('POST', `/admin/listener-applications/${user.id}/approve`, { token: admin.token, body: {} });
  check(`approve listener ${name}`, status === 200, data);
  return { ...user, name, user: data.user };
}

// ---------- Realtime ----------

/** Connects the user's socket and records every event it receives */
export function connect(user: TestUser): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(host, { auth: { token: user.token }, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    socket.onAny((event, payload) => user.events.push({ event, payload, at: Date.now() }));
    socket.on('disconnect', (reason) => user.events.push({ event: 'disconnect', payload: reason, at: Date.now() }));
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
    user.socket = socket;
  });
}

/** Resolves with the error message a socket gets when connecting with this token */
export function connectError(token: string): Promise<string> {
  return new Promise((resolve) => {
    const socket = io(host, { auth: { token }, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    socket.on('connect', () => resolve('connected'));
    socket.on('connect_error', (error) => resolve(error.message));
  });
}

/** Waits for an event received after `since` (ms timestamp). Returns its payload, or null on timeout. */
export async function waitFor(
  user: TestUser,
  event: string,
  { since = 0, timeout = 5000, where = () => true }: { since?: number; timeout?: number; where?: (payload: any) => boolean } = {},
): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = user.events.find((e) => e.event === event && e.at >= since && where(e.payload));
    if (found) return found.payload;
    await sleep(25);
  }
  return null;
}
