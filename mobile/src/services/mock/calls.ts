import { CALL_RATE_PER_MIN, LISTENER_SHARE, RING_TIMEOUT_SEC } from '@/constants/config';
import type { CallEndReason, CallRecord, CallStatus } from '@/types';
import type { CallService } from '../contracts';
import { realtime } from '../realtime';
import { ApiError } from '@/utils/errors';
import { formatShortDuration } from '@/utils/format';
import { createId, pickRandom } from '@/utils/id';
import { persist, type DbCall, type DbState } from './db';
import {
  addTransaction,
  adjustBalance,
  getUserOrThrow,
  isBlockedEitherWay,
  latency,
  requireMe,
  toPublicUser,
} from './helpers';

/** Timers that drive the simulated other side of each call */
const timers = new Map<string, ReturnType<typeof setTimeout>[]>();

function addTimer(callId: string, timer: ReturnType<typeof setTimeout>) {
  timers.set(callId, [...(timers.get(callId) ?? []), timer]);
}

function clearTimers(callId: string) {
  timers.get(callId)?.forEach((t) => {
    clearTimeout(t);
    clearInterval(t);
  });
  timers.delete(callId);
}

function findCall(db: DbState, callId: string): DbCall {
  const call = db.calls.find((c) => c.id === callId);
  if (!call) throw new ApiError('NOT_FOUND', 'Call not found.');
  return call;
}

function hasOngoingCall(db: DbState, userId: string): boolean {
  return db.calls.some(
    (c) => (c.status === 'ringing' || c.status === 'active') && (c.callerId === userId || c.calleeId === userId),
  );
}

function finishCall(db: DbState, call: DbCall, meId: string, status: CallStatus, reason: CallEndReason) {
  if (call.status !== 'ringing' && call.status !== 'active') return;
  clearTimers(call.id);

  const now = Date.now();
  call.status = status;
  call.endedAt = new Date(now).toISOString();
  call.durationSec = call.answeredAt ? Math.round((now - new Date(call.answeredAt).getTime()) / 1000) : 0;

  const caller = db.users[call.callerId];
  const callee = db.users[call.calleeId];
  const duration = formatShortDuration(call.durationSec);
  if (call.coinsCharged > 0 && caller) {
    addTransaction(db, caller.id, 'call_charge', -call.coinsCharged, `Call with ${callee?.name ?? 'user'} · ${duration}`);
  }
  if (call.coinsEarned > 0 && callee) {
    addTransaction(db, callee.id, 'call_earning', call.coinsEarned, `Call with ${caller?.name ?? 'user'} · ${duration}`);
  }
  if (status === 'completed') {
    if (caller) caller.totalCalls += 1;
    if (callee) callee.totalCalls += 1;
  }
  persist();

  realtime.emit('call:ended', {
    callId: call.id,
    reason,
    durationSec: call.durationSec,
    coins: meId === call.callerId ? call.coinsCharged : call.coinsEarned,
  });
}

/** Bills one started minute. Returns false if the caller ran out of coins. */
function billMinute(db: DbState, call: DbCall, meId: string): boolean {
  if (call.callerId === meId) {
    if ((db.wallets[meId] ?? 0) < CALL_RATE_PER_MIN) return false;
    call.coinsCharged += CALL_RATE_PER_MIN;
    realtime.emit('wallet:balance', { balance: adjustBalance(db, meId, -CALL_RATE_PER_MIN) });
  } else if (db.users[meId]?.role === 'listener') {
    const earned = Math.floor(CALL_RATE_PER_MIN * LISTENER_SHARE);
    call.coinsEarned += earned;
    realtime.emit('wallet:balance', { balance: adjustBalance(db, meId, earned) });
  }
  persist();
  return true;
}

function answerCall(db: DbState, call: DbCall, meId: string) {
  clearTimers(call.id);
  call.status = 'active';
  call.answeredAt = new Date().toISOString();
  realtime.emit('call:accepted', { callId: call.id });

  // Billing: charged at the start of every minute
  if (!billMinute(db, call, meId)) {
    finishCall(db, call, meId, 'completed', 'insufficient_balance');
    return;
  }
  addTimer(
    call.id,
    setInterval(() => {
      if (!billMinute(db, call, meId)) finishCall(db, call, meId, 'completed', 'insufficient_balance');
    }, 60_000),
  );

  // The simulated peer hangs up on their own after 2–6 minutes
  addTimer(
    call.id,
    setTimeout(() => finishCall(db, call, meId, 'completed', 'peer_hangup'), (120 + Math.random() * 240) * 1000),
  );
}

function newCall(callerId: string, calleeId: string): DbCall {
  return {
    id: createId('call'),
    callerId,
    calleeId,
    createdAt: new Date().toISOString(),
    answeredAt: null,
    endedAt: null,
    status: 'ringing',
    durationSec: 0,
    coinsCharged: 0,
    coinsEarned: 0,
    ratings: {},
  };
}

export const mockCalls: CallService = {
  async startCall(userId) {
    await latency(200, 400);
    const { db, me } = await requireMe();
    const peer = getUserOrThrow(db, userId);

    if (isBlockedEitherWay(db, me.id, peer.id)) {
      throw new ApiError('BLOCKED', 'You can’t call this user.');
    }
    if (!peer.isOnline || (peer.role === 'listener' && !peer.isAvailable) || hasOngoingCall(db, peer.id)) {
      throw new ApiError('USER_UNAVAILABLE', `${peer.name} is not available right now. Try again later.`);
    }
    if ((db.wallets[me.id] ?? 0) < CALL_RATE_PER_MIN) {
      throw new ApiError('INSUFFICIENT_BALANCE', `You need at least ${CALL_RATE_PER_MIN} coins to start a call.`);
    }

    const call = newCall(me.id, peer.id);
    db.calls.push(call);
    persist();

    // Decide how the simulated peer responds
    const acceptChance = peer.role === 'listener' ? 0.85 : 0.65;
    const roll = Math.random();
    if (roll < acceptChance) {
      addTimer(call.id, setTimeout(() => answerCall(db, call, me.id), 2500 + Math.random() * 2500));
    } else if (roll < acceptChance + 0.1) {
      addTimer(call.id, setTimeout(() => finishCall(db, call, me.id, 'rejected', 'rejected'), 3000 + Math.random() * 3000));
    } else {
      addTimer(call.id, setTimeout(() => finishCall(db, call, me.id, 'missed', 'no_answer'), RING_TIMEOUT_SEC * 1000));
    }
    return { callId: call.id };
  },

  async acceptCall(callId) {
    const { db, me } = await requireMe();
    const call = findCall(db, callId);
    if (call.calleeId !== me.id || call.status !== 'ringing') {
      throw new ApiError('NOT_FOUND', 'This call has already ended.');
    }
    answerCall(db, call, me.id);
  },

  async rejectCall(callId) {
    const { db, me } = await requireMe();
    finishCall(db, findCall(db, callId), me.id, 'rejected', 'rejected');
  },

  async endCall(callId) {
    const { db, me } = await requireMe();
    const call = findCall(db, callId);
    if (call.status === 'ringing') finishCall(db, call, me.id, 'cancelled', 'cancelled');
    else finishCall(db, call, me.id, 'completed', 'hangup');
  },

  async rateCall(callId, stars) {
    await latency(150, 300);
    const { db, me } = await requireMe();
    const call = findCall(db, callId);
    if (call.ratings[me.id]) return;
    call.ratings[me.id] = stars;

    const peer = db.users[call.callerId === me.id ? call.calleeId : call.callerId];
    if (peer) {
      peer.rating = Math.round(((peer.rating * peer.ratingCount + stars) / (peer.ratingCount + 1)) * 10) / 10;
      peer.ratingCount += 1;
    }
    persist();
  },

  async getHistory() {
    await latency();
    const { db, me } = await requireMe();
    return db.calls
      .filter((c) => (c.callerId === me.id || c.calleeId === me.id) && c.status !== 'ringing' && c.status !== 'active')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .flatMap((c): CallRecord[] => {
        const outgoing = c.callerId === me.id;
        const peer = db.users[outgoing ? c.calleeId : c.callerId];
        if (!peer) return [];
        return [
          {
            id: c.id,
            peer: toPublicUser(peer),
            direction: outgoing ? 'outgoing' : 'incoming',
            status: c.status as CallStatus,
            startedAt: c.createdAt,
            durationSec: c.durationSec,
            coins: outgoing ? c.coinsCharged : c.coinsEarned,
            rating: c.ratings[me.id] ?? null,
          },
        ];
      });
  },

  async findMatch(language) {
    await latency(1800, 3500);
    const { db, me } = await requireMe();
    const available = Object.values(db.users).filter(
      (u) =>
        u.id !== me.id &&
        u.role === 'listener' &&
        u.isOnline &&
        u.isAvailable &&
        !hasOngoingCall(db, u.id) &&
        !isBlockedEitherWay(db, me.id, u.id),
    );
    const sameLanguage = language ? available.filter((u) => u.languages.includes(language)) : available;
    const match = pickRandom(sameLanguage.length > 0 ? sameLanguage : available);
    if (!match) throw new ApiError('NO_MATCH', 'No listeners are free right now. Please try again in a minute.');
    return toPublicUser(match);
  },

  async simulateIncomingCall() {
    const { db, me } = await requireMe();
    if (hasOngoingCall(db, me.id)) {
      throw new ApiError('USER_UNAVAILABLE', 'You are already in a call.');
    }
    const caller = pickRandom(
      Object.values(db.users).filter(
        (u) => u.id !== me.id && u.isOnline && u.profileComplete && !isBlockedEitherWay(db, me.id, u.id),
      ),
    );
    if (!caller) throw new ApiError('NO_MATCH', 'Nobody is online to call you.');

    const call = newCall(caller.id, me.id);
    db.calls.push(call);
    persist();

    addTimer(call.id, setTimeout(() => finishCall(db, call, me.id, 'missed', 'no_answer'), RING_TIMEOUT_SEC * 1000));
    realtime.emit('call:incoming', { callId: call.id, from: toPublicUser(caller) });
  },
};
