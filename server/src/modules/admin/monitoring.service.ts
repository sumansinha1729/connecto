import type { Types } from 'mongoose';

import { env } from '../../config/env';
import { Call } from '../calls/call.model';
import { PayoutRequest } from '../earnings/earnings.model';
import { Room } from '../rooms/room.model';
import { Report } from '../users/relations.model';
import { User, type UserDoc } from '../users/user.model';
import { Transaction } from '../wallet/wallet.model';
import { AdminAction } from './adminAction.model';

/*
 * Read-only numbers for the admin panel's monitoring views. Days and hours are
 * counted in India time (IST), which is what the client's team lives in.
 */

const TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A call this short that the listener ended is suspicious: they earn the first minute anyway */
const SHORT_CALL_SEC = 30;

export type Period = 'today' | '7d' | '30d';

interface Card {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  role: string;
}

const card = (user: UserDoc | undefined): Card | null =>
  user ? { id: user.id as string, name: user.name, avatar: user.avatar, phone: user.phone, role: user.role } : null;

async function cardsById(ids: (Types.ObjectId | string)[]): Promise<Map<string, Card>> {
  const users = await User.find({ _id: { $in: ids } });
  return new Map(users.map((u) => [u.id as string, card(u)!]));
}

/** Midnight IST today, as a UTC Date */
function startOfTodayIst(now = Date.now()): Date {
  return new Date(Math.floor((now + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS);
}

// ---------- Live now ----------

export async function getLive() {
  const now = Date.now();
  const [usersOnline, listenersOnline, listenersAvailable, listenersInCall, activeCalls, ringingCalls, rooms] = await Promise.all([
    User.countDocuments({ status: 'active', role: 'user', isOnline: true }),
    User.countDocuments({ status: 'active', role: 'listener', isOnline: true }),
    User.countDocuments({ status: 'active', role: 'listener', isOnline: true, isAvailable: true, activeCallId: null }),
    User.countDocuments({ status: 'active', role: 'listener', activeCallId: { $ne: null } }),
    Call.find({ status: 'active' }).sort({ answeredAt: 1 }).lean(),
    Call.find({ status: 'ringing' }).sort({ createdAt: 1 }).lean(),
    Room.find({ status: 'live' }).sort({ createdAt: -1 }).lean(),
  ]);

  const people = await cardsById([
    ...[...activeCalls, ...ringingCalls].flatMap((c) => [c.callerId, c.calleeId]),
    ...rooms.map((r) => r.hostId),
  ]);
  const toCall = (c: (typeof activeCalls)[number]) => ({
    id: String(c._id),
    caller: people.get(String(c.callerId)) ?? null,
    listener: people.get(String(c.calleeId)) ?? null,
    startedAt: (c.answeredAt ?? c.createdAt).toISOString(),
    durationSec: c.answeredAt ? Math.round((now - c.answeredAt.getTime()) / 1000) : 0,
    coins: c.coinsCharged,
    earnedPaise: c.earnedPaise,
  });

  return {
    generatedAt: new Date(now).toISOString(),
    people: { usersOnline, listenersOnline, listenersAvailable, listenersInCall },
    calls: activeCalls.map(toCall),
    ringing: ringingCalls.map(toCall),
    rooms: rooms.map((r) => ({
      id: String(r._id),
      title: r.title,
      topic: r.topic,
      language: r.language,
      host: people.get(String(r.hostId)) ?? null,
      participants: r.participants.length,
      speakers: r.participants.filter((p) => p.role !== 'listener').length,
      startedAt: r.createdAt.toISOString(),
    })),
  };
}

// ---------- Activity & money over time ----------

interface Bucket {
  /** "2026-10-03" for days, "14" (IST hour) for today */
  key: string;
  signups: number;
  calls: number;
  missedCalls: number;
  minutes: number;
  coinsSpent: number;
  listenerEarningsPaise: number;
  coinsBought: number;
  rechargeInr: number;
}

export async function getMetrics(period: Period) {
  const todayStart = startOfTodayIst();
  const days = period === '30d' ? 30 : period === '7d' ? 7 : 1;
  const since = new Date(todayStart.getTime() - (days - 1) * DAY_MS);
  const hourly = period === 'today';
  const keyOf = (field: string) => ({
    $dateToString: { format: hourly ? '%H' : '%Y-%m-%d', date: field, timezone: TIMEZONE },
  });

  const [signups, answered, unanswered, recharges, hours, top, payoutsPaid, payoutsPending] = await Promise.all([
    User.aggregate<{ _id: string; n: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: keyOf('$createdAt'), n: { $sum: 1 } } },
    ]),
    Call.aggregate<{ _id: string; n: number; sec: number; coins: number; paise: number }>([
      { $match: { status: 'completed', answeredAt: { $ne: null, $gte: since } } },
      {
        $group: {
          _id: keyOf('$answeredAt'),
          n: { $sum: 1 },
          sec: { $sum: '$durationSec' },
          coins: { $sum: '$coinsCharged' },
          paise: { $sum: '$earnedPaise' },
        },
      },
    ]),
    Call.aggregate<{ _id: string; n: number }>([
      { $match: { status: { $in: ['missed', 'rejected'] }, createdAt: { $gte: since } } },
      { $group: { _id: keyOf('$createdAt'), n: { $sum: 1 } } },
    ]),
    // Real payments only: the development "recharge" button doesn't count as money
    Transaction.aggregate<{ _id: string; coins: number; inr: number }>([
      { $match: { type: 'recharge', createdAt: { $gte: since }, 'meta.provider': { $ne: 'dev' } } },
      { $group: { _id: keyOf('$createdAt'), coins: { $sum: '$amount' }, inr: { $sum: { $ifNull: ['$meta.priceInr', 0] } } } },
    ]),
    Call.aggregate<{ _id: number; n: number }>([
      { $match: { status: 'completed', answeredAt: { $ne: null, $gte: since } } },
      { $group: { _id: { $hour: { date: '$answeredAt', timezone: TIMEZONE } }, n: { $sum: 1 } } },
    ]),
    Call.aggregate<{ _id: Types.ObjectId; calls: number; sec: number; paise: number }>([
      { $match: { status: 'completed', answeredAt: { $ne: null, $gte: since } } },
      { $group: { _id: '$calleeId', calls: { $sum: 1 }, sec: { $sum: '$durationSec' }, paise: { $sum: '$earnedPaise' } } },
      { $sort: { sec: -1 } },
      { $limit: 10 },
    ]),
    PayoutRequest.aggregate<{ n: number; paise: number }>([
      { $match: { status: 'paid', processedAt: { $gte: since } } },
      { $group: { _id: null, n: { $sum: 1 }, paise: { $sum: '$amountPaise' } } },
    ]),
    PayoutRequest.aggregate<{ n: number; paise: number }>([
      { $match: { status: 'requested' } },
      { $group: { _id: null, n: { $sum: 1 }, paise: { $sum: '$amountPaise' } } },
    ]),
  ]);

  // Every hour / day in the range, including empty ones, so charts have no gaps
  const keys = hourly
    ? Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
    : Array.from({ length: days }, (_, i) => new Date(since.getTime() + i * DAY_MS + IST_OFFSET_MS).toISOString().slice(0, 10));
  const series: Bucket[] = keys.map((key) => {
    const a = answered.find((x) => x._id === key);
    const r = recharges.find((x) => x._id === key);
    return {
      key,
      signups: signups.find((x) => x._id === key)?.n ?? 0,
      calls: a?.n ?? 0,
      missedCalls: unanswered.find((x) => x._id === key)?.n ?? 0,
      minutes: Math.round((a?.sec ?? 0) / 60),
      coinsSpent: a?.coins ?? 0,
      listenerEarningsPaise: a?.paise ?? 0,
      coinsBought: r?.coins ?? 0,
      rechargeInr: r?.inr ?? 0,
    };
  });

  const sum = (field: keyof Omit<Bucket, 'key'>) => series.reduce((total, b) => total + b[field], 0);
  const totalCalls = sum('calls');
  const totalAttempts = totalCalls + sum('missedCalls');
  const topCards = await cardsById(top.map((t) => t._id));
  const topUsers = await User.find({ _id: { $in: top.map((t) => t._id) } }, { rating: 1, ratingCount: 1 }).lean();

  return {
    period,
    since: since.toISOString(),
    totals: {
      signups: sum('signups'),
      calls: totalCalls,
      minutes: sum('minutes'),
      /** Share of call attempts that were picked up */
      answerRate: totalAttempts ? Math.round((totalCalls / totalAttempts) * 100) : null,
      avgCallMinutes: totalCalls ? Math.round((sum('minutes') / totalCalls) * 10) / 10 : 0,
      coinsSpent: sum('coinsSpent'),
      coinsBought: sum('coinsBought'),
      rechargeInr: sum('rechargeInr'),
      listenerEarningsPaise: sum('listenerEarningsPaise'),
      payoutsPaidPaise: payoutsPaid[0]?.paise ?? 0,
      payoutsPaidCount: payoutsPaid[0]?.n ?? 0,
      payoutsPendingPaise: payoutsPending[0]?.paise ?? 0,
      payoutsPendingCount: payoutsPending[0]?.n ?? 0,
    },
    pricing: { callRateCoinsPerMin: env.CALL_RATE_COINS_PER_MIN, listenerEarningPaisePerMin: env.LISTENER_EARNING_PAISE_PER_MIN },
    series,
    busiestHours: Array.from({ length: 24 }, (_, hour) => ({ hour, calls: hours.find((h) => h._id === hour)?.n ?? 0 })),
    topListeners: top.map((t) => {
      const stats = topUsers.find((u) => String(u._id) === String(t._id));
      return {
        listener: topCards.get(String(t._id)) ?? null,
        calls: t.calls,
        minutes: Math.round(t.sec / 60),
        earningsPaise: t.paise,
        rating: stats?.rating ?? 0,
        ratingCount: stats?.ratingCount ?? 0,
      };
    }),
  };
}

// ---------- Safety ----------

export async function getSafety() {
  const weekAgo = new Date(Date.now() - 7 * DAY_MS);
  const [openReports, reportsByReason, reported, shortCalls, lowRated, recentBans, recentActions] = await Promise.all([
    Report.countDocuments({ status: 'open' }),
    Report.aggregate<{ _id: string; n: number }>([
      { $match: { createdAt: { $gte: weekAgo } } },
      { $group: { _id: '$reason', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]),
    // People with several open reports against them
    Report.aggregate<{ _id: Types.ObjectId; n: number; last: Date }>([
      { $match: { status: 'open' } },
      { $group: { _id: '$userId', n: { $sum: 1 }, last: { $max: '$createdAt' } } },
      { $match: { n: { $gte: 2 } } },
      { $sort: { n: -1 } },
      { $limit: 20 },
    ]),
    // Listeners who often end calls within seconds (they still earn the first minute)
    Call.aggregate<{ _id: Types.ObjectId; total: number; short: number }>([
      { $match: { status: 'completed', answeredAt: { $ne: null, $gte: weekAgo } } },
      {
        $group: {
          _id: '$calleeId',
          total: { $sum: 1 },
          short: {
            $sum: { $cond: [{ $and: [{ $lt: ['$durationSec', SHORT_CALL_SEC] }, { $eq: ['$endedBy', '$calleeId'] }] }, 1, 0] },
          },
        },
      },
      { $match: { short: { $gte: 3 } } },
      { $sort: { short: -1 } },
      { $limit: 20 },
    ]),
    User.find({ status: 'active', listenerStatus: 'approved', ratingCount: { $gte: 5 }, rating: { $lt: 3 } })
      .sort({ rating: 1 })
      .limit(20),
    User.find({ status: 'banned' }).sort({ bannedAt: -1 }).limit(10),
    AdminAction.find().sort({ createdAt: -1 }).limit(15).lean(),
  ]);

  const cards = await cardsById([
    ...reported.map((r) => r._id),
    ...shortCalls.map((s) => s._id),
    ...recentActions.flatMap((a) => [a.adminId, ...(a.targetUserId ? [a.targetUserId] : [])]),
  ]);

  return {
    openReports,
    reportsThisWeek: reportsByReason.map((r) => ({ reason: r._id, count: r.n })),
    mostReported: reported.map((r) => ({ user: cards.get(String(r._id)) ?? null, openReports: r.n, lastReportAt: r.last.toISOString() })),
    shortCallListeners: shortCalls.map((s) => ({
      listener: cards.get(String(s._id)) ?? null,
      calls: s.total,
      shortCalls: s.short,
      shortSharePct: Math.round((s.short / s.total) * 100),
    })),
    lowRatedListeners: lowRated.map((u) => ({ listener: card(u), rating: u.rating, ratingCount: u.ratingCount })),
    recentBans: recentBans.map((u) => ({ user: card(u), reason: u.banReason, bannedAt: u.bannedAt?.toISOString() ?? null })),
    recentAdminActions: recentActions.map((a) => ({
      id: String(a._id),
      action: a.action,
      admin: cards.get(String(a.adminId)) ?? null,
      target: a.targetUserId ? (cards.get(String(a.targetUserId)) ?? null) : null,
      details: a.details,
      at: a.createdAt.toISOString(),
    })),
  };
}
