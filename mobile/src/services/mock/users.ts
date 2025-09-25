import type { UserService } from '../contracts';
import { ApiError } from '@/utils/errors';
import { createId } from '@/utils/id';
import { persist } from './db';
import { getUserOrThrow, isBlockedEitherWay, latency, requireMe, toMe, toPublicUser } from './helpers';

export const mockUsers: UserService = {
  async getMe() {
    await latency(100, 250);
    const { me } = await requireMe();
    return toMe(me);
  },

  async updateProfile(update) {
    await latency();
    const { me } = await requireMe();
    if (update.name !== undefined && update.name.trim().length < 2) {
      throw new ApiError('VALIDATION', 'Name must be at least 2 characters.');
    }
    Object.assign(me, update, update.name !== undefined ? { name: update.name.trim() } : {});
    me.profileComplete = Boolean(me.name && me.gender && me.age && me.languages.length > 0);
    // Only listeners can be "available"; regular users are always reachable while online
    if (me.role === 'user') me.isAvailable = false;
    persist();
    return toMe(me);
  },

  async deleteAccount() {
    await latency();
    const { db, me } = await requireMe();
    delete db.users[me.id];
    delete db.wallets[me.id];
    delete db.transactions[me.id];
    delete db.favorites[me.id];
    delete db.blocked[me.id];
    Object.keys(db.sessions).forEach((token) => {
      if (db.sessions[token] === me.id) delete db.sessions[token];
    });
    persist();
  },

  async listUsers(filters) {
    await latency();
    const { db, me } = await requireMe();
    return Object.values(db.users)
      .filter((u) => u.id !== me.id && u.profileComplete && !isBlockedEitherWay(db, me.id, u.id))
      .filter((u) => !filters.listenersOnly || u.role === 'listener')
      .filter((u) => !filters.onlineOnly || u.isOnline)
      .filter((u) => !filters.language || u.languages.includes(filters.language))
      .filter((u) => !filters.gender || u.gender === filters.gender)
      .sort(
        (a, b) =>
          Number(b.isOnline) - Number(a.isOnline) ||
          Number(b.role === 'listener') - Number(a.role === 'listener') ||
          b.rating - a.rating,
      )
      .map(toPublicUser);
  },

  async getUser(userId) {
    await latency(150, 350);
    const { db } = await requireMe();
    return toPublicUser(getUserOrThrow(db, userId));
  },

  async listFavorites() {
    await latency();
    const { db, me } = await requireMe();
    return (db.favorites[me.id] ?? [])
      .map((id) => db.users[id])
      .filter((u) => u && !isBlockedEitherWay(db, me.id, u.id))
      .map(toPublicUser);
  },

  async isFavorite(userId) {
    const { db, me } = await requireMe();
    return (db.favorites[me.id] ?? []).includes(userId);
  },

  async setFavorite(userId, favorite) {
    await latency(100, 250);
    const { db, me } = await requireMe();
    const current = new Set(db.favorites[me.id] ?? []);
    if (favorite) current.add(userId);
    else current.delete(userId);
    db.favorites[me.id] = [...current];
    persist();
  },

  async listBlocked() {
    await latency();
    const { db, me } = await requireMe();
    return (db.blocked[me.id] ?? [])
      .map((id) => db.users[id])
      .filter(Boolean)
      .map(toPublicUser);
  },

  async setBlocked(userId, blocked) {
    await latency();
    const { db, me } = await requireMe();
    const current = new Set(db.blocked[me.id] ?? []);
    if (blocked) {
      current.add(userId);
      db.favorites[me.id] = (db.favorites[me.id] ?? []).filter((id) => id !== userId);
    } else {
      current.delete(userId);
    }
    db.blocked[me.id] = [...current];
    persist();
  },

  async report(userId, reason, details) {
    await latency();
    const { db, me } = await requireMe();
    getUserOrThrow(db, userId);
    db.reports.push({
      id: createId('rep'),
      reporterId: me.id,
      userId,
      reason,
      details: details.trim(),
      createdAt: new Date().toISOString(),
    });
    persist();
  },
};
