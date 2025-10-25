import type { Types } from 'mongoose';

import { env } from '../../config/env';
import type { CallEndReason } from '../../realtime/events';
import { emitToUser } from '../../realtime/io';
import { isUserConnected } from '../../realtime/presence';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import { User, type UserDoc } from '../users/user.model';
import { toPublicUser } from '../users/user.serializer';
import { getBlockedIds, isBlockedEitherWay } from '../users/users.service';
import { voiceCredentials } from '../voice/agora';
import { creditIntoEntry, debitIntoEntry, getBalance } from '../wallet/wallet.service';
import { Call, FINAL_STATUSES, type CallDoc, type EndReason, type FinalStatus } from './call.model';

/*
 * Call lifecycle
 *
 *   startCall ──▶ ringing ──acceptCall──▶ active ──endCall / out of coins / disconnect──▶ completed
 *                    │
 *                    ├── rejectCall ──▶ rejected
 *                    ├── caller endCall ──▶ cancelled
 *                    └── no answer in CALL_RING_TIMEOUT_SEC ──▶ missed
 *
 * Billing: the caller is charged CALL_RATE_COINS_PER_MIN at pickup and then at the
 * start of every minute. A listener callee earns LISTENER_SHARE_PERCENT of it.
 */

// ---------- Timers (ring timeout + billing) for calls on this server ----------

const timers = new Map<string, { ring?: NodeJS.Timeout; billing?: NodeJS.Timeout }>();

function setRingTimer(callId: string, timer: NodeJS.Timeout) {
  timers.set(callId, { ...timers.get(callId), ring: timer });
}

function setBillingTimer(callId: string, timer: NodeJS.Timeout) {
  timers.set(callId, { ...timers.get(callId), billing: timer });
}

function clearTimers(callId: string) {
  const t = timers.get(callId);
  if (t?.ring) clearTimeout(t.ring);
  if (t?.billing) clearInterval(t.billing);
  timers.delete(callId);
}

const runSafely = (label: string, task: () => Promise<unknown>) => () => {
  task().catch((error) => logger.error(label, error));
};

// ---------- One call at a time ----------

/** Atomically marks the user as busy with this call. False if they're already in one. */
async function claimUser(userId: Types.ObjectId, callId: Types.ObjectId): Promise<boolean> {
  const result = await User.updateOne({ _id: userId, activeCallId: null }, { activeCallId: callId });
  return result.modifiedCount === 1;
}

async function releaseUser(userId: Types.ObjectId, callId: Types.ObjectId) {
  await User.updateOne({ _id: userId, activeCallId: callId }, { activeCallId: null });
}

// ---------- Starting, answering, ending ----------

const isReachable = (user: UserDoc) =>
  user.status === 'active' && isUserConnected(user.id) && (user.role !== 'listener' || user.isAvailable);

export async function startCall(caller: UserDoc, calleeId: string) {
  if (caller.id === calleeId) throw ApiError.badRequest('You can’t call yourself.');
  if (!caller.profileComplete) throw ApiError.badRequest('Complete your profile before making calls.');

  const callee = await User.findOne({ _id: calleeId, status: 'active', profileComplete: true });
  if (!callee) throw ApiError.notFound('This user is not available.');
  if (await isBlockedEitherWay(caller._id, callee._id)) throw new ApiError(403, 'BLOCKED', 'You can’t call this user.');
  if (!isReachable(callee)) {
    throw new ApiError(409, 'USER_UNAVAILABLE', `${callee.name} is not available right now. Try again later.`);
  }
  if ((await getBalance(caller._id)) < env.CALL_RATE_COINS_PER_MIN) {
    throw ApiError.badRequest(
      `You need at least ${env.CALL_RATE_COINS_PER_MIN} coins to start a call.`,
      'INSUFFICIENT_BALANCE',
    );
  }

  const call = new Call({ callerId: caller._id, calleeId: callee._id, channel: 'pending' });
  call.channel = `call_${call.id}`;

  if (!(await claimUser(caller._id, call._id))) {
    throw ApiError.conflict('You are already in a call.', 'USER_UNAVAILABLE');
  }
  if (!(await claimUser(callee._id, call._id))) {
    await releaseUser(caller._id, call._id);
    throw new ApiError(409, 'USER_UNAVAILABLE', `${callee.name} is on another call. Try again in a few minutes.`);
  }
  await call.save();

  const expiresAt = new Date(Date.now() + env.CALL_RING_TIMEOUT_SEC * 1000);
  setRingTimer(
    call.id,
    setTimeout(
      runSafely('Ring timeout failed', () => finishCall(call.id, 'missed', 'no_answer')),
      env.CALL_RING_TIMEOUT_SEC * 1000,
    ),
  );
  emitToUser(callee.id, 'call:incoming', { callId: call.id, from: toPublicUser(caller), expiresAt: expiresAt.toISOString() });

  return { callId: call.id as string, peer: toPublicUser(callee), expiresAt: expiresAt.toISOString() };
}

export async function acceptCall(callee: UserDoc, callId: string) {
  const call = await Call.findOneAndUpdate(
    { _id: callId, calleeId: callee._id, status: 'ringing' },
    { status: 'active', answeredAt: new Date() },
    { returnDocument: 'after' },
  );
  if (!call) throw ApiError.notFound('This call has already ended.');
  clearTimers(call.id);

  // The first minute is charged on pickup
  if (!(await billMinute(call.id, 1))) throw ApiError.conflict('The caller ran out of coins.');
  setBillingTimer(
    call.id,
    setInterval(runSafely('Billing failed', () => billNextMinute(call.id)), env.billingIntervalSec * 1000),
  );

  const callerVoice = voiceCredentials(call.channel, String(call.callerId), true);
  const calleeVoice = voiceCredentials(call.channel, String(call.calleeId), true);
  emitToUser(String(call.callerId), 'call:accepted', { callId: call.id, voice: callerVoice });
  emitToUser(String(call.calleeId), 'call:accepted', { callId: call.id, voice: calleeVoice });
  return { callId: call.id as string, voice: calleeVoice };
}

export async function rejectCall(callee: UserDoc, callId: string) {
  const call = await Call.findOne({ _id: callId, calleeId: callee._id });
  if (!call) throw ApiError.notFound('Call not found.');
  await finishCall(call.id, 'rejected', 'rejected', callee._id);
}

/** Hang up an active call, or cancel/decline a ringing one. Safe to call twice. */
export async function endCall(user: UserDoc, callId: string) {
  const call = await Call.findOne({ _id: callId, $or: [{ callerId: user._id }, { calleeId: user._id }] });
  if (!call) throw ApiError.notFound('Call not found.');

  if (call.status === 'ringing') {
    const isCaller = call.callerId.equals(user._id);
    await finishCall(call.id, isCaller ? 'cancelled' : 'rejected', isCaller ? 'cancelled' : 'rejected', user._id);
  } else if (call.status === 'active') {
    await finishCall(call.id, 'completed', 'hangup', user._id);
  }
}

/** The receiver-facing reason: whoever didn't hang up sees "peer_hangup" */
function reasonFor(userId: Types.ObjectId, reason: EndReason, endedBy: Types.ObjectId | null | undefined): CallEndReason {
  if (reason === 'hangup' || reason === 'disconnected' || reason === 'server_restart') {
    return endedBy && !endedBy.equals(userId) ? 'peer_hangup' : 'hangup';
  }
  return reason;
}

/** Moves a ringing/active call to its final state exactly once and notifies both users. */
async function finishCall(callId: string, status: FinalStatus, reason: EndReason, endedBy?: Types.ObjectId) {
  const endedAt = new Date();
  const call = await Call.findOneAndUpdate(
    { _id: callId, status: { $in: ['ringing', 'active'] } },
    { status, endedAt, endReason: reason, endedBy: endedBy ?? null },
    { returnDocument: 'after' },
  );
  if (!call) return; // already finished
  clearTimers(call.id);

  call.durationSec = call.answeredAt ? Math.round((endedAt.getTime() - call.answeredAt.getTime()) / 1000) : 0;
  await Call.updateOne({ _id: call._id }, { durationSec: call.durationSec });
  await Promise.all([releaseUser(call.callerId, call._id), releaseUser(call.calleeId, call._id)]);
  if (status === 'completed') {
    await User.updateMany({ _id: { $in: [call.callerId, call.calleeId] } }, { $inc: { totalCalls: 1 } });
  }

  for (const [userId, coins] of [
    [call.callerId, call.coinsCharged],
    [call.calleeId, call.coinsEarned],
  ] as const) {
    emitToUser(String(userId), 'call:ended', {
      callId: call.id,
      reason: reasonFor(userId, reason, call.endedBy),
      durationSec: call.durationSec,
      coins,
    });
  }
}

// ---------- Billing ----------

async function billNextMinute(callId: string) {
  const call = await Call.findById(callId, { status: 1, billedMinutes: 1 }).lean();
  if (!call || call.status !== 'active') return clearTimers(callId);
  await billMinute(callId, call.billedMinutes + 1);
}

/**
 * Charges minute `minute` of an active call. Returns false if the caller ran out
 * of coins (the call is then ended). Each minute can only ever be billed once.
 */
async function billMinute(callId: string, minute: number): Promise<boolean> {
  const call = await Call.findOneAndUpdate(
    { _id: callId, status: 'active', billedMinutes: minute - 1 },
    { $inc: { billedMinutes: 1 } },
    { returnDocument: 'after' },
  );
  if (!call) return true; // already billed, or the call ended meanwhile

  const [caller, callee] = await Promise.all([User.findById(call.callerId), User.findById(call.calleeId)]);
  const rate = env.CALL_RATE_COINS_PER_MIN;

  try {
    const balance = await debitIntoEntry({
      userId: call.callerId,
      amount: rate,
      type: 'call_charge',
      entryKey: `call:${call.id}:charge`,
      description: `Call with ${callee?.name ?? 'user'} · ${minute} min`,
      meta: { callId: call.id },
    });
    await Call.updateOne({ _id: call._id }, { $inc: { coinsCharged: rate } });
    emitToUser(String(call.callerId), 'wallet:balance', { balance });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'INSUFFICIENT_BALANCE') {
      await Call.updateOne({ _id: call._id }, { $inc: { billedMinutes: -1 } });
      await finishCall(call.id, 'completed', 'insufficient_balance');
      return false;
    }
    throw error;
  }

  const earning = Math.floor((rate * env.LISTENER_SHARE_PERCENT) / 100);
  if (callee?.role === 'listener' && earning > 0) {
    const balance = await creditIntoEntry({
      userId: call.calleeId,
      amount: earning,
      type: 'call_earning',
      entryKey: `call:${call.id}:earning`,
      description: `Call with ${caller?.name ?? 'user'} · ${minute} min`,
      meta: { callId: call.id },
    });
    await Call.updateOne({ _id: call._id }, { $inc: { coinsEarned: earning } });
    emitToUser(String(call.calleeId), 'wallet:balance', { balance });
  }
  return true;
}

// ---------- Queries ----------

function toHistoryItem(call: CallDoc, me: UserDoc, peer: UserDoc) {
  const outgoing = call.callerId.equals(me._id);
  return {
    id: call.id as string,
    peer: toPublicUser(peer),
    direction: outgoing ? ('outgoing' as const) : ('incoming' as const),
    status: call.status as FinalStatus,
    startedAt: call.createdAt.toISOString(),
    durationSec: call.durationSec,
    coins: outgoing ? call.coinsCharged : call.coinsEarned,
    rating: call.ratings.find((r) => r.userId.equals(me._id))?.stars ?? null,
  };
}

export async function getHistory(me: UserDoc, { before, limit }: { before?: Date; limit: number }) {
  const calls = await Call.find({
    $or: [{ callerId: me._id }, { calleeId: me._id }],
    status: { $in: FINAL_STATUSES },
    ...(before && { createdAt: { $lt: before } }),
  })
    .sort({ createdAt: -1 })
    .limit(limit);

  const peerIds = calls.map((c) => (c.callerId.equals(me._id) ? c.calleeId : c.callerId));
  const peers = new Map((await User.find({ _id: { $in: peerIds } })).map((u) => [u.id as string, u]));
  return calls.flatMap((call, i) => {
    const peer = peers.get(String(peerIds[i]));
    return peer ? [toHistoryItem(call, me, peer)] : [];
  });
}

/** The user's ringing/active call, e.g. to restore the call screen after an app restart */
export async function getActiveCall(me: UserDoc) {
  if (!me.activeCallId) return null;
  const call = await Call.findOne({ _id: me.activeCallId, status: { $in: ['ringing', 'active'] } });
  if (!call) return null;
  const outgoing = call.callerId.equals(me._id);
  const peer = await User.findById(outgoing ? call.calleeId : call.callerId);
  if (!peer) return null;
  return {
    callId: call.id as string,
    status: call.status as 'ringing' | 'active',
    direction: outgoing ? ('outgoing' as const) : ('incoming' as const),
    peer: toPublicUser(peer),
    answeredAt: call.answeredAt?.toISOString() ?? null,
    voice: call.status === 'active' ? voiceCredentials(call.channel, me.id, true) : null,
  };
}

export async function rateCall(me: UserDoc, callId: string, stars: number) {
  const call = await Call.findOne({ _id: callId, $or: [{ callerId: me._id }, { calleeId: me._id }] });
  if (!call) throw ApiError.notFound('Call not found.');
  if (call.status !== 'completed' || !call.answeredAt) throw ApiError.badRequest('Only completed calls can be rated.');

  const added = await Call.updateOne(
    { _id: call._id, 'ratings.userId': { $ne: me._id } },
    { $push: { ratings: { userId: me._id, stars } } },
  );
  if (added.modifiedCount === 0) return; // already rated

  const peerId = call.callerId.equals(me._id) ? call.calleeId : call.callerId;
  const peer = await User.findOneAndUpdate(
    { _id: peerId },
    { $inc: { ratingSum: stars, ratingCount: 1 } },
    { returnDocument: 'after' },
  );
  if (peer) {
    await User.updateOne({ _id: peer._id }, { rating: Math.round((peer.ratingSum / peer.ratingCount) * 10) / 10 });
  }
}

/** A random free listener, preferring one who speaks `language` */
export async function findMatch(me: UserDoc, language?: string) {
  const blocked = await getBlockedIds(me._id);
  const base = {
    _id: { $nin: [me._id, ...blocked] },
    status: 'active',
    profileComplete: true,
    role: 'listener',
    isAvailable: true,
    isOnline: true,
    activeCallId: null,
  };

  for (const match of language ? [{ ...base, languages: language }, base] : [base]) {
    const sample = await User.aggregate([{ $match: match }, { $sample: { size: 20 } }]);
    const found = sample.map((doc) => User.hydrate(doc)).find((u) => isReachable(u));
    if (found) return toPublicUser(found);
  }
  throw new ApiError(404, 'NO_MATCH', 'No listeners are free right now. Please try again in a minute.');
}

// ---------- Disconnects and restarts ----------

/** Ends the calls of a user who went offline */
export async function endCallsOfOfflineUser(userId: string) {
  const calls = await Call.find({ status: { $in: ['ringing', 'active'] }, $or: [{ callerId: userId }, { calleeId: userId }] });
  for (const call of calls) {
    const isCaller = String(call.callerId) === userId;
    if (call.status === 'ringing') {
      await finishCall(call.id, isCaller ? 'cancelled' : 'missed', isCaller ? 'cancelled' : 'no_answer');
    } else {
      await finishCall(call.id, 'completed', 'disconnected', isCaller ? call.callerId : call.calleeId);
    }
  }
}

/** Calls can't survive a restart (their timers are gone), so close them on boot */
export async function recoverCallsOnStartup() {
  const now = new Date();
  const stale = await Call.find({ status: { $in: ['ringing', 'active'] } });
  for (const call of stale) {
    const answered = call.status === 'active' && call.answeredAt;
    await Call.updateOne(
      { _id: call._id },
      {
        status: answered ? 'completed' : 'missed',
        endReason: 'server_restart',
        endedAt: now,
        durationSec: answered ? Math.round((now.getTime() - call.answeredAt!.getTime()) / 1000) : 0,
      },
    );
  }
  await User.updateMany({ activeCallId: { $ne: null } }, { activeCallId: null });
  if (stale.length) logger.warn(`Closed ${stale.length} call(s) left open by the last shutdown`);
}

export async function shutdownCalls() {
  for (const callId of [...timers.keys()]) clearTimers(callId);
}
