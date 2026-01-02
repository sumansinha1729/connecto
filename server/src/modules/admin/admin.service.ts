import type { Types } from 'mongoose';

import { emitToUser, disconnectUser } from '../../realtime/io';
import { ApiError } from '../../utils/ApiError';
import { revokeAllSessions } from '../auth/tokens';
import { Call } from '../calls/call.model';
import { endCallsOfOfflineUser, getHistory } from '../calls/calls.service';
import { Room } from '../rooms/room.model';
import { endRoom, leaveAllRooms } from '../rooms/rooms.service';
import { Report } from '../users/relations.model';
import { User, type UserDoc } from '../users/user.model';
import { toAdminUser } from '../users/user.serializer';
import { Transaction } from '../wallet/wallet.model';
import { credit, debit, getBalance, listTransactions, toTransactionDto } from '../wallet/wallet.service';
import { EarningsAccount, PayoutRequest } from '../earnings/earnings.model';
import { listPayouts, markPayoutPaid, rejectPayout, toPayoutDto } from '../earnings/earnings.service';
import { AdminAction, type AdminActionType } from './adminAction.model';

interface Page {
  page: number;
  limit: number;
}

async function audit(admin: UserDoc, action: AdminActionType, targetUserId: Types.ObjectId | string | null, details = {}) {
  await AdminAction.create({ adminId: admin._id, action, targetUserId, details });
}

async function getUserOrThrow(userId: string): Promise<UserDoc> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found.');
  return user;
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Minimal user card used inside lists (reports, applications) */
const userCard = (user: UserDoc | undefined) =>
  user ? { id: user.id as string, name: user.name, avatar: user.avatar, phone: user.phone, status: user.status } : null;

// ---------- Users ----------

export interface UserSearch extends Page {
  q?: string;
  status?: string;
  role?: string;
  listenerStatus?: string;
}

export async function searchUsers({ q, status, role, listenerStatus, page, limit }: UserSearch) {
  const query: Record<string, unknown> = { status: status ?? { $ne: 'deleted' } };
  if (role) query.role = role;
  if (listenerStatus) query.listenerStatus = listenerStatus;
  if (q) {
    const digits = q.replace(/\D/g, '');
    query.$or = [
      { name: { $regex: escapeRegex(q.trim()), $options: 'i' } },
      ...(digits.length >= 4 ? [{ phone: { $regex: escapeRegex(digits) } }] : []),
    ];
  }
  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(query),
  ]);
  return { users: users.map(toAdminUser), total, page };
}

export async function getUserDetail(userId: string) {
  const user = await getUserOrThrow(userId);
  const [earnings, payouts, balance, transactions, calls, reportsAgainst, reportsMade, actions] = await Promise.all([
    EarningsAccount.findOne({ userId: user._id }).lean(),
    PayoutRequest.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10),
    getBalance(user._id),
    listTransactions(user._id, { limit: 20 }),
    getHistory(user, { limit: 20 }),
    Report.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20).lean(),
    Report.countDocuments({ reporterId: user._id }),
    AdminAction.find({ targetUserId: user._id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  return {
    user: toAdminUser(user),
    wallet: { balance, transactions: transactions.map(toTransactionDto) },
    earnings: {
      balancePaise: earnings?.balancePaise ?? 0,
      lifetimePaise: earnings?.lifetimePaise ?? 0,
      payouts: payouts.map(toPayoutDto),
    },
    calls,
    reports: {
      against: reportsAgainst.map((r) => ({
        id: String(r._id),
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      madeCount: reportsMade,
    },
    auditLog: actions.map((a) => ({
      action: a.action,
      adminId: String(a.adminId),
      details: a.details,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

/** Bans immediately: logs out every device, ends calls and rooms. */
export async function banUser(admin: UserDoc, userId: string, reason: string) {
  if (admin.id === userId) throw ApiError.badRequest('You can’t ban yourself.');
  const target = await getUserOrThrow(userId);
  if (target.isAdmin) throw ApiError.forbidden('Admins can’t be banned. Remove their admin role first.');
  if (target.status === 'deleted') throw ApiError.badRequest('This account was deleted.');

  const banned = await User.findOneAndUpdate(
    { _id: target._id, status: 'active' },
    { status: 'banned', banReason: reason, bannedAt: new Date(), isAvailable: false, isOnline: false },
    { returnDocument: 'after' },
  );
  if (!banned) throw ApiError.conflict('This user is already banned.');

  await revokeAllSessions(banned._id);
  disconnectUser(banned.id);
  await endCallsOfOfflineUser(banned.id);
  await leaveAllRooms(banned.id);
  await audit(admin, 'ban_user', banned._id, { reason });
  return toAdminUser(banned);
}

export async function unbanUser(admin: UserDoc, userId: string) {
  const user = await User.findOneAndUpdate(
    { _id: userId, status: 'banned' },
    { status: 'active', banReason: null, bannedAt: null },
    { returnDocument: 'after' },
  );
  if (!user) throw ApiError.conflict('This user is not banned.');
  await audit(admin, 'unban_user', user._id);
  return toAdminUser(user);
}

/** Manual coin correction (refunds, goodwill). Positive adds, negative removes. */
export async function adjustWallet(admin: UserDoc, userId: string, amount: number, reason: string) {
  const user = await getUserOrThrow(userId);
  const entry = {
    userId: user._id,
    amount: Math.abs(amount),
    type: 'adjustment' as const,
    description: `Adjustment: ${reason}`,
    meta: { adminId: admin.id },
  };
  const { balance } = amount > 0 ? await credit(entry) : await debit(entry);
  emitToUser(user.id, 'wallet:balance', { balance });
  await audit(admin, 'adjust_wallet', user._id, { amount, reason });
  return { balance };
}

// ---------- Listener applications ----------

export async function listApplications(status: 'pending' | 'approved' | 'rejected', { page, limit }: Page) {
  const query: Record<string, unknown> = { listenerStatus: status, status: { $ne: 'deleted' } };
  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ 'listenerApplication.appliedAt': status === 'pending' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(query),
  ]);
  return { applications: users.map(toAdminUser), total, page };
}

/** Approval turns the account into a listener (their coins stay, paused, while they are one) */
export async function approveListener(admin: UserDoc, userId: string, note?: string) {
  const user = await User.findOneAndUpdate(
    { _id: userId, listenerStatus: 'pending', status: 'active' },
    {
      listenerStatus: 'approved',
      role: 'listener',
      signupIntent: 'listener',
      isAvailable: true,
      'listenerApplication.reviewedAt': new Date(),
      'listenerApplication.reviewedBy': admin._id,
      'listenerApplication.note': note ?? null,
    },
    { returnDocument: 'after' },
  );
  if (!user) throw ApiError.conflict('There is no pending application for this user.');
  emitToUser(user.id, 'account:updated', { reason: 'listener_approved' });
  await audit(admin, 'approve_listener', user._id, { note });
  return toAdminUser(user);
}

export async function rejectListener(admin: UserDoc, userId: string, note: string) {
  const user = await User.findOneAndUpdate(
    { _id: userId, listenerStatus: 'pending' },
    {
      listenerStatus: 'rejected',
      'listenerApplication.reviewedAt': new Date(),
      'listenerApplication.reviewedBy': admin._id,
      'listenerApplication.note': note,
    },
    { returnDocument: 'after' },
  );
  if (!user) throw ApiError.conflict('There is no pending application for this user.');
  emitToUser(user.id, 'account:updated', { reason: 'listener_rejected' });
  await audit(admin, 'reject_listener', user._id, { note });
  return toAdminUser(user);
}

/** Takes listener rights away: the account becomes a normal user again (paused coins usable again) */
export async function revokeListener(admin: UserDoc, userId: string, note: string) {
  const user = await User.findOneAndUpdate(
    { _id: userId, listenerStatus: 'approved' },
    { listenerStatus: 'rejected', role: 'user', signupIntent: 'user', isAvailable: false, 'listenerApplication.note': note },
    { returnDocument: 'after' },
  );
  if (!user) throw ApiError.conflict('This user is not an approved listener.');
  emitToUser(user.id, 'account:updated', { reason: 'listener_revoked' });
  await audit(admin, 'revoke_listener', user._id, { note });
  return toAdminUser(user);
}

// ---------- Reports ----------

export async function listReports(status: 'open' | 'reviewed' | 'actioned', { page, limit }: Page) {
  const [reports, total] = await Promise.all([
    Report.find({ status })
      .sort({ createdAt: status === 'open' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Report.countDocuments({ status }),
  ]);
  const ids = reports.flatMap((r) => [r.reporterId, r.userId]);
  const users = new Map((await User.find({ _id: { $in: ids } })).map((u) => [u.id as string, u]));
  const openCounts = new Map(
    (
      await Report.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { status: 'open', userId: { $in: reports.map((r) => r.userId) } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ])
    ).map((c) => [String(c._id), c.count]),
  );

  return {
    reports: reports.map((r) => ({
      id: r.id as string,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      resolutionNote: r.resolutionNote ?? null,
      reporter: userCard(users.get(String(r.reporterId))),
      reported: userCard(users.get(String(r.userId))),
      /** How many open reports the reported user has in total */
      reportedOpenReports: openCounts.get(String(r.userId)) ?? 0,
    })),
    total,
    page,
  };
}

export async function resolveReport(
  admin: UserDoc,
  reportId: string,
  { status, note, ban }: { status: 'reviewed' | 'actioned'; note?: string; ban?: boolean },
) {
  const report = await Report.findOneAndUpdate(
    { _id: reportId, status: 'open' },
    { status, resolvedBy: admin._id, resolvedAt: new Date(), resolutionNote: note ?? null },
    { returnDocument: 'after' },
  );
  if (!report) throw ApiError.conflict('This report was already resolved.');

  if (ban) {
    const target = await User.findById(report.userId);
    if (target?.status === 'active') await banUser(admin, target.id, note ?? `Reported for ${report.reason}`);
  }
  await audit(admin, 'resolve_report', report.userId, { reportId: report.id, status, note, ban: Boolean(ban) });
}

// ---------- Payouts ----------

export { listPayouts };

export async function payPayout(admin: UserDoc, payoutId: string, reference: string) {
  const request = await markPayoutPaid(admin._id, payoutId, reference);
  await audit(admin, 'mark_payout_paid', request.userId, { payoutId, amountPaise: request.amountPaise, reference });
}

export async function declinePayout(admin: UserDoc, payoutId: string, note: string) {
  const request = await rejectPayout(admin._id, payoutId, note);
  await audit(admin, 'reject_payout', request.userId, { payoutId, amountPaise: request.amountPaise, note });
}

// ---------- Rooms ----------

export async function endRoomAsAdmin(admin: UserDoc, roomId: string) {
  const room = await Room.findOne({ _id: roomId, status: 'live' });
  if (!room) throw ApiError.notFound('This room has already ended.');
  await endRoom(room.id);
  await audit(admin, 'end_room', room.hostId, { roomId: room.id, title: room.title });
}

// ---------- Dashboard ----------

export async function getStats() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [
    usersTotal,
    usersNew,
    usersBanned,
    usersOnline,
    listenersApproved,
    listenersAvailable,
    applicationsPending,
    callsActive,
    callStats,
    rechargeStats,
    reportsOpen,
    roomsLive,
    payoutStats,
    earnedStats,
  ] = await Promise.all([
    User.countDocuments({ status: { $ne: 'deleted' } }),
    User.countDocuments({ status: { $ne: 'deleted' }, createdAt: { $gte: since } }),
    User.countDocuments({ status: 'banned' }),
    User.countDocuments({ status: 'active', isOnline: true }),
    User.countDocuments({ status: 'active', listenerStatus: 'approved' }),
    User.countDocuments({ status: 'active', role: 'listener', isAvailable: true, isOnline: true }),
    User.countDocuments({ listenerStatus: 'pending', status: 'active' }),
    Call.countDocuments({ status: 'active' }),
    Call.aggregate<{ count: number; seconds: number; coins: number }>([
      { $match: { status: 'completed', answeredAt: { $ne: null }, createdAt: { $gte: since } } },
      { $group: { _id: null, count: { $sum: 1 }, seconds: { $sum: '$durationSec' }, coins: { $sum: '$coinsCharged' } } },
    ]),
    Transaction.aggregate<{ count: number; coins: number; inr: number }>([
      { $match: { type: 'recharge', createdAt: { $gte: since }, 'meta.provider': { $ne: 'dev' } } },
      { $group: { _id: null, count: { $sum: 1 }, coins: { $sum: '$amount' }, inr: { $sum: '$meta.priceInr' } } },
    ]),
    Report.countDocuments({ status: 'open' }),
    Room.countDocuments({ status: 'live' }),
    PayoutRequest.aggregate<{ count: number; paise: number }>([
      { $match: { status: 'requested' } },
      { $group: { _id: null, count: { $sum: 1 }, paise: { $sum: '$amountPaise' } } },
    ]),
    Call.aggregate<{ paise: number }>([
      { $match: { status: 'completed', createdAt: { $gte: since } } },
      { $group: { _id: null, paise: { $sum: '$earnedPaise' } } },
    ]),
  ]);

  return {
    users: { total: usersTotal, new24h: usersNew, banned: usersBanned, onlineNow: usersOnline },
    listeners: { approved: listenersApproved, availableNow: listenersAvailable, pendingApplications: applicationsPending },
    calls: {
      activeNow: callsActive,
      completed24h: callStats[0]?.count ?? 0,
      minutes24h: Math.round((callStats[0]?.seconds ?? 0) / 60),
      coinsCharged24h: callStats[0]?.coins ?? 0,
    },
    revenue: { recharges24h: rechargeStats[0]?.count ?? 0, inr24h: rechargeStats[0]?.inr ?? 0, coins24h: rechargeStats[0]?.coins ?? 0 },
    reports: { open: reportsOpen },
    rooms: { live: roomsLive },
    payouts: { pending: payoutStats[0]?.count ?? 0, pendingPaise: payoutStats[0]?.paise ?? 0 },
    listenerEarnings24hPaise: earnedStats[0]?.paise ?? 0,
  };
}

export async function listAuditLog({ page, limit, targetUserId }: Page & { targetUserId?: string }) {
  const query = targetUserId ? { targetUserId } : {};
  const actions = await AdminAction.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  return {
    actions: actions.map((a) => ({
      id: String(a._id),
      action: a.action,
      adminId: String(a.adminId),
      targetUserId: a.targetUserId ? String(a.targetUserId) : null,
      details: a.details,
      createdAt: a.createdAt.toISOString(),
    })),
    page,
  };
}
