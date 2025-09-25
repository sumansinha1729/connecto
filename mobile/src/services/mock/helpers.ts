import type { Me, Transaction, TransactionType, User } from '@/types';
import { ApiError } from '@/utils/errors';
import { createId, delay } from '@/utils/id';
import { session } from '../session';
import { getDb, type DbState, type DbUser } from './db';

/** Simulates network latency so loading states are visible */
export function latency(min = 250, max = 600): Promise<void> {
  return delay(min + Math.random() * (max - min));
}

export async function requireMe(): Promise<{ db: DbState; me: DbUser }> {
  const db = await getDb();
  const token = session.getToken();
  const userId = token ? db.sessions[token] : undefined;
  const me = userId ? db.users[userId] : undefined;
  if (!me) throw new ApiError('UNAUTHORIZED', 'Your session has expired. Please log in again.');
  return { db, me };
}

export function toPublicUser(user: DbUser): User {
  const { phone: _phone, profileComplete: _profileComplete, ...publicUser } = user;
  return publicUser;
}

export function toMe(user: DbUser): Me {
  return { ...user };
}

export function getUserOrThrow(db: DbState, userId: string): DbUser {
  const user = db.users[userId];
  if (!user) throw new ApiError('NOT_FOUND', 'This user no longer exists.');
  return user;
}

export function isBlockedEitherWay(db: DbState, a: string, b: string): boolean {
  return (db.blocked[a] ?? []).includes(b) || (db.blocked[b] ?? []).includes(a);
}

export function addTransaction(
  db: DbState,
  userId: string,
  type: TransactionType,
  amount: number,
  description: string,
): Transaction {
  const tx: Transaction = {
    id: createId('tx'),
    type,
    amount,
    description,
    createdAt: new Date().toISOString(),
  };
  db.transactions[userId] = [tx, ...(db.transactions[userId] ?? [])];
  return tx;
}

export function adjustBalance(db: DbState, userId: string, delta: number): number {
  const next = (db.wallets[userId] ?? 0) + delta;
  db.wallets[userId] = next;
  return next;
}
