import { mongo, type Types } from 'mongoose';

import { env } from '../../config/env';
import { emitToUser } from '../../realtime/io';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import { Call } from '../calls/call.model';
import { assertListener } from '../users/accountRules';
import type { UserDoc } from '../users/user.model';
import {
  EarningsAccount,
  EarningsEntry,
  PayoutRequest,
  type EarningEntryType,
  type EarningsEntryDoc,
  type PayoutRequestDoc,
} from './earnings.model';

type UserId = Types.ObjectId | string;

export const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

/** Midnight in India (IST, UTC+5:30), as a UTC Date */
function startOfTodayIst(): Date {
  const IST_OFFSET_MS = 330 * 60 * 1000;
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  nowIst.setUTCHours(0, 0, 0, 0);
  return new Date(nowIst.getTime() - IST_OFFSET_MS);
}

export async function getEarningsBalance(userId: UserId): Promise<number> {
  return (await EarningsAccount.findOne({ userId }).lean())?.balancePaise ?? 0;
}

async function notifyBalance(userId: UserId, balancePaise: number) {
  emitToUser(String(userId), 'earnings:balance', { balancePaise });
}

async function writeEntry(
  userId: UserId,
  type: EarningEntryType,
  amountPaise: number,
  balanceAfterPaise: number,
  description: string,
  entryKey: string,
  meta?: Record<string, unknown>,
) {
  await EarningsEntry.updateOne(
    { entryKey },
    {
      $inc: { amountPaise },
      $set: { balanceAfterPaise, description, ...(meta && { meta }) },
      $setOnInsert: { userId, type },
    },
    { upsert: true },
  );
}

/**
 * Adds one billed minute of a call to the listener's earnings. All minutes of a
 * call accumulate into one history row ("Call with Arjun · 3 min").
 */
export async function creditCallMinute(listenerId: UserId, callId: string, callerName: string, minute: number) {
  const amount = env.LISTENER_EARNING_PAISE_PER_MIN;
  if (amount <= 0) return 0;
  const account = await EarningsAccount.findOneAndUpdate(
    { userId: listenerId },
    { $inc: { balancePaise: amount, lifetimePaise: amount } },
    { upsert: true, returnDocument: 'after' },
  );
  await writeEntry(listenerId, 'call', amount, account.balancePaise, `Call with ${callerName} · ${minute} min`, `call:${callId}:earning`, {
    callId,
  });
  await notifyBalance(listenerId, account.balancePaise);
  return amount;
}

// ---------- Listener-facing ----------

export function toEntryDto(entry: EarningsEntryDoc) {
  return {
    id: entry.id as string,
    type: entry.type,
    amountPaise: entry.amountPaise,
    description: entry.description,
    createdAt: entry.createdAt.toISOString(),
  };
}

export function toPayoutDto(request: PayoutRequestDoc) {
  const method = request.method;
  return {
    id: request.id as string,
    amountPaise: request.amountPaise,
    status: request.status,
    methodLabel: method?.kind === 'upi' ? `UPI · ${method.upiId}` : `Bank · ••••${(method?.accountNumber ?? '').slice(-4)}`,
    reference: request.reference ?? null,
    note: request.note ?? null,
    createdAt: request.createdAt.toISOString(),
    processedAt: request.processedAt?.toISOString() ?? null,
  };
}

/** Everything the listener's Earnings and Dashboard screens show */
export async function getEarningsSummary(listener: UserDoc) {
  assertListener(listener, 'view earnings');
  const today = startOfTodayIst();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [account, entries, todayEntries, weekEntries, callsToday, payouts] = await Promise.all([
    EarningsAccount.findOne({ userId: listener._id }).lean(),
    EarningsEntry.find({ userId: listener._id }).sort({ createdAt: -1 }).limit(30),
    EarningsEntry.find({ userId: listener._id, type: 'call', createdAt: { $gte: today } }, { amountPaise: 1 }).lean(),
    EarningsEntry.find({ userId: listener._id, type: 'call', createdAt: { $gte: weekAgo } }, { amountPaise: 1 }).lean(),
    Call.find({ calleeId: listener._id, status: 'completed', answeredAt: { $gte: today } }, { durationSec: 1 }).lean(),
    PayoutRequest.find({ userId: listener._id }).sort({ createdAt: -1 }).limit(10),
  ]);
  const sum = (rows: { amountPaise: number }[]) => rows.reduce((total, r) => total + r.amountPaise, 0);

  return {
    balancePaise: account?.balancePaise ?? 0,
    lifetimePaise: account?.lifetimePaise ?? 0,
    todayPaise: sum(todayEntries),
    weekPaise: sum(weekEntries),
    callsToday: callsToday.length,
    minutesToday: Math.round(callsToday.reduce((total, c) => total + c.durationSec, 0) / 60),
    entries: entries.map(toEntryDto),
    payouts: payouts.map(toPayoutDto),
    settings: {
      ratePaisePerMin: env.LISTENER_EARNING_PAISE_PER_MIN,
      minWithdrawalPaise: env.PAYOUT_MIN_PAISE,
      schedule: env.PAYOUT_SCHEDULE,
    },
  };
}

export interface PayoutMethodInput {
  kind: 'upi' | 'bank';
  upiId?: string;
  accountName: string;
  accountNumber?: string;
  ifsc?: string;
}

export async function setPayoutMethod(listener: UserDoc, method: PayoutMethodInput) {
  assertListener(listener, 'add payout details');
  listener.set('payoutMethod', {
    kind: method.kind,
    accountName: method.accountName,
    upiId: method.kind === 'upi' ? method.upiId : null,
    accountNumber: method.kind === 'bank' ? method.accountNumber : null,
    ifsc: method.kind === 'bank' ? method.ifsc?.toUpperCase() : null,
  });
  await listener.save();
}

/** Requests a payout of the whole balance (or `amountPaise`). The money is reserved immediately. */
export async function requestWithdrawal(listener: UserDoc, amountPaise?: number) {
  assertListener(listener, 'withdraw earnings');
  const method = listener.payoutMethod;
  if (!method?.kind) throw ApiError.badRequest('Add your UPI or bank details first.');

  const amount = amountPaise ?? (await getEarningsBalance(listener._id));
  if (amount < env.PAYOUT_MIN_PAISE) {
    throw ApiError.badRequest(`You can withdraw once you have at least ${rupees(env.PAYOUT_MIN_PAISE)}.`);
  }
  if (await PayoutRequest.exists({ userId: listener._id, status: 'requested' })) {
    throw ApiError.conflict('You already have a withdrawal in progress.');
  }

  // Reserve the money first (atomic, can't go below zero)
  const account = await EarningsAccount.findOneAndUpdate(
    { userId: listener._id, balancePaise: { $gte: amount } },
    { $inc: { balancePaise: -amount } },
    { returnDocument: 'after' },
  );
  if (!account) {
    // A simultaneous request may have just reserved the balance
    if (await PayoutRequest.exists({ userId: listener._id, status: 'requested' })) {
      throw ApiError.conflict('You already have a withdrawal in progress.');
    }
    throw ApiError.badRequest('You don’t have that much to withdraw.');
  }

  let request: PayoutRequestDoc;
  try {
    request = await PayoutRequest.create({
      userId: listener._id,
      amountPaise: amount,
      method: {
        kind: method.kind,
        upiId: method.upiId,
        accountName: method.accountName,
        accountNumber: method.accountNumber,
        ifsc: method.ifsc,
      },
    });
  } catch (error) {
    await EarningsAccount.updateOne({ userId: listener._id }, { $inc: { balancePaise: amount } });
    if (error instanceof mongo.MongoServerError && error.code === 11000) {
      throw ApiError.conflict('You already have a withdrawal in progress.');
    }
    throw error;
  }

  await writeEntry(listener._id, 'payout', -amount, account.balancePaise, 'Withdrawal requested', `payout:${request.id}`, {
    payoutId: request.id,
  });
  await notifyBalance(listener._id, account.balancePaise);
  return toPayoutDto(request);
}

// ---------- Admin-facing ----------

export async function listPayouts(status: 'requested' | 'paid' | 'rejected', { page, limit }: { page: number; limit: number }) {
  const [requests, total] = await Promise.all([
    PayoutRequest.find({ status })
      .sort({ createdAt: status === 'requested' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate<{ userId: UserDoc }>('userId'),
    PayoutRequest.countDocuments({ status }),
  ]);
  return {
    payouts: requests.map((r) => ({
      ...toPayoutDto(r as unknown as PayoutRequestDoc),
      method: r.method,
      listener: r.userId ? { id: r.userId.id as string, name: r.userId.name, avatar: r.userId.avatar, phone: r.userId.phone } : null,
    })),
    total,
    page,
  };
}

export async function markPayoutPaid(adminId: Types.ObjectId, payoutId: string, reference: string) {
  const request = await PayoutRequest.findOneAndUpdate(
    { _id: payoutId, status: 'requested' },
    { status: 'paid', reference, processedAt: new Date(), processedBy: adminId },
    { returnDocument: 'after' },
  );
  if (!request) throw ApiError.conflict('This withdrawal was already processed.');
  await EarningsEntry.updateOne({ entryKey: `payout:${request.id}` }, { description: `Withdrawal paid · ref ${reference}` });
  return request;
}

/** Rejects a withdrawal and returns the reserved money to the listener's balance */
export async function rejectPayout(adminId: Types.ObjectId, payoutId: string, note: string) {
  const request = await PayoutRequest.findOneAndUpdate(
    { _id: payoutId, status: 'requested' },
    { status: 'rejected', note, processedAt: new Date(), processedBy: adminId },
    { returnDocument: 'after' },
  );
  if (!request) throw ApiError.conflict('This withdrawal was already processed.');

  const account = await EarningsAccount.findOneAndUpdate(
    { userId: request.userId },
    { $inc: { balancePaise: request.amountPaise } },
    { upsert: true, returnDocument: 'after' },
  );
  try {
    await writeEntry(
      request.userId,
      'payout_reversal',
      request.amountPaise,
      account.balancePaise,
      `Withdrawal returned · ${note}`,
      `payout-reversal:${request.id}`,
    );
  } catch (error) {
    logger.error('Failed to record payout reversal', error);
  }
  await notifyBalance(request.userId, account.balancePaise);
  return request;
}
