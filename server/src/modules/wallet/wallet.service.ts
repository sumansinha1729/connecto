import { mongo, type Types } from 'mongoose';

import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import { Transaction, Wallet, type TransactionDoc, type TransactionType } from './wallet.model';

type UserId = Types.ObjectId | string;

interface LedgerEntry {
  userId: UserId;
  /** Always positive; the direction comes from credit() / debit() */
  amount: number;
  type: TransactionType;
  description: string;
  idempotencyKey?: string;
  meta?: Record<string, unknown>;
}

export interface LedgerResult {
  balance: number;
  /** False when the idempotency key had already been applied */
  applied: boolean;
}

const isDuplicateKey = (error: unknown) => error instanceof mongo.MongoServerError && error.code === 11000;

export async function getBalance(userId: UserId): Promise<number> {
  const wallet = await Wallet.findOne({ userId }).lean();
  return wallet?.balance ?? 0;
}

/**
 * Adds coins. The ledger row is written first so a repeated idempotency key
 * (e.g. a retried payment webhook) is rejected before the balance changes.
 *
 * Note: without MongoDB transactions (a local standalone server has none) a
 * crash between the two writes can leave them out of sync. On Atlas this
 * should be wrapped in a session transaction.
 */
export async function credit(entry: LedgerEntry): Promise<LedgerResult> {
  assertPositive(entry.amount);
  let tx: TransactionDoc;
  try {
    tx = await Transaction.create({ ...entry, amount: entry.amount });
  } catch (error) {
    if (isDuplicateKey(error)) return { balance: await getBalance(entry.userId), applied: false };
    throw error;
  }

  try {
    const wallet = await Wallet.findOneAndUpdate(
      { userId: entry.userId },
      { $inc: { balance: entry.amount } },
      { upsert: true, returnDocument: 'after' },
    );
    tx.balanceAfter = wallet.balance;
    await tx.save();
    return { balance: wallet.balance, applied: true };
  } catch (error) {
    await Transaction.deleteOne({ _id: tx._id }).catch(() => {});
    throw error;
  }
}

/**
 * Removes coins atomically: the balance check and the deduction are a single
 * update, so two concurrent debits can never take the balance below zero.
 */
export async function debit(entry: LedgerEntry): Promise<LedgerResult> {
  assertPositive(entry.amount);
  if (entry.idempotencyKey && (await Transaction.exists({ idempotencyKey: entry.idempotencyKey }))) {
    return { balance: await getBalance(entry.userId), applied: false };
  }

  const wallet = await Wallet.findOneAndUpdate(
    { userId: entry.userId, balance: { $gte: entry.amount } },
    { $inc: { balance: -entry.amount } },
    { returnDocument: 'after' },
  );
  if (!wallet) {
    throw ApiError.badRequest('You don’t have enough coins for this.', 'INSUFFICIENT_BALANCE');
  }

  try {
    await Transaction.create({ ...entry, amount: -entry.amount, balanceAfter: wallet.balance });
  } catch (error) {
    // Same key applied concurrently: give the coins back
    await Wallet.updateOne({ userId: entry.userId }, { $inc: { balance: entry.amount } });
    if (isDuplicateKey(error)) return { balance: await getBalance(entry.userId), applied: false };
    logger.error('Failed to record debit, refunded', error);
    throw error;
  }
  return { balance: wallet.balance, applied: true };
}

export async function listTransactions(userId: UserId, { limit = 30, before }: { limit?: number; before?: Date } = {}) {
  return Transaction.find({ userId, ...(before && { createdAt: { $lt: before } }) })
    .sort({ createdAt: -1 })
    .limit(limit);
}

export function toTransactionDto(tx: TransactionDoc) {
  return {
    id: tx.id as string,
    type: tx.type,
    amount: tx.amount,
    description: tx.description,
    createdAt: tx.createdAt.toISOString(),
  };
}

function assertPositive(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error(`Ledger amount must be a positive integer, got ${amount}`);
}
