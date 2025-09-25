/**
 * In-memory fake backend database, persisted to AsyncStorage so the app
 * keeps its state between reloads. Acts like the server would.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CallStatus, ReportReason, RoomRole, Transaction, User } from '@/types';
import { seedRooms, seedUsers } from './seed';

const STORAGE_KEY = 'connecto.mockdb.v1';

export interface DbUser extends User {
  phone: string;
  profileComplete: boolean;
}

export interface DbCall {
  id: string;
  callerId: string;
  calleeId: string;
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  status: 'ringing' | 'active' | CallStatus;
  durationSec: number;
  coinsCharged: number;
  coinsEarned: number;
  /** userId → stars that user gave the call */
  ratings: Record<string, number>;
}

export interface DbRoomParticipant {
  userId: string;
  role: RoomRole;
  isMuted: boolean;
  handRaised: boolean;
}

export interface DbRoom {
  id: string;
  title: string;
  topic: string;
  language: string;
  hostId: string;
  participants: DbRoomParticipant[];
  createdAt: string;
}

export interface DbReport {
  id: string;
  reporterId: string;
  userId: string;
  reason: ReportReason;
  details: string;
  createdAt: string;
}

export interface DbState {
  users: Record<string, DbUser>;
  /** token → userId */
  sessions: Record<string, string>;
  /** phone → code */
  otps: Record<string, string>;
  wallets: Record<string, number>;
  transactions: Record<string, Transaction[]>;
  calls: DbCall[];
  favorites: Record<string, string[]>;
  blocked: Record<string, string[]>;
  reports: DbReport[];
  /** Live rooms are not persisted: they are re-seeded on every app start */
  rooms: Record<string, DbRoom>;
}

function createInitialState(): DbState {
  return {
    users: seedUsers(),
    sessions: {},
    otps: {},
    wallets: {},
    transactions: {},
    calls: [],
    favorites: {},
    blocked: {},
    reports: [],
    rooms: seedRooms(),
  };
}

let state: DbState | null = null;
let loading: Promise<DbState> | null = null;

async function load(): Promise<DbState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as DbState;
      // Calls that were in progress when the app closed can't be resumed
      saved.calls.forEach((call) => {
        if (call.status === 'ringing') call.status = 'missed';
        if (call.status === 'active') call.status = 'completed';
      });
      saved.rooms = seedRooms();
      return saved;
    }
  } catch (error) {
    console.warn('[mockdb] failed to load, starting fresh', error);
  }
  return createInitialState();
}

export async function getDb(): Promise<DbState> {
  if (state) return state;
  loading ??= load().then((loaded) => {
    state = loaded;
    return loaded;
  });
  return loading;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced write of the whole database to AsyncStorage */
export function persist(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!state) return;
    const { rooms: _rooms, ...durable } = state;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(durable)).catch((error) =>
      console.warn('[mockdb] failed to save', error),
    );
  }, 300);
}
