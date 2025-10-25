import { env } from '../config/env';
import { User } from '../modules/users/user.model';
import { logger } from '../utils/logger';

/**
 * Tracks which users have at least one connected socket. In-memory, so it
 * only works with a single server instance (use Redis when scaling out).
 *
 * A user is marked offline only after PRESENCE_GRACE_SEC without any socket,
 * so a brief network drop or app switch doesn't end their call.
 */
const sockets = new Map<string, Set<string>>();
const offlineTimers = new Map<string, NodeJS.Timeout>();

type OfflineHandler = (userId: string) => Promise<void>;
const offlineHandlers: OfflineHandler[] = [];

/** Run when a user has really gone offline (e.g. end their calls, leave rooms) */
export function onUserOffline(handler: OfflineHandler) {
  offlineHandlers.push(handler);
}

export function isUserConnected(userId: string): boolean {
  return (sockets.get(userId)?.size ?? 0) > 0;
}

export async function socketConnected(userId: string, socketId: string) {
  clearTimeout(offlineTimers.get(userId));
  offlineTimers.delete(userId);

  const userSockets = sockets.get(userId) ?? new Set();
  const wasOffline = userSockets.size === 0;
  userSockets.add(socketId);
  sockets.set(userId, userSockets);

  if (wasOffline) await User.updateOne({ _id: userId }, { isOnline: true });
}

export function socketDisconnected(userId: string, socketId: string) {
  const userSockets = sockets.get(userId);
  if (!userSockets) return;
  userSockets.delete(socketId);
  if (userSockets.size > 0) return;

  clearTimeout(offlineTimers.get(userId));
  offlineTimers.set(
    userId,
    setTimeout(() => {
      offlineTimers.delete(userId);
      if (isUserConnected(userId)) return;
      sockets.delete(userId);
      markOffline(userId).catch((error) => logger.error(`Failed to mark ${userId} offline`, error));
    }, env.PRESENCE_GRACE_SEC * 1000),
  );
}

async function markOffline(userId: string) {
  await User.updateOne({ _id: userId }, { isOnline: false, lastSeenAt: new Date() });
  for (const handler of offlineHandlers) {
    await handler(userId).catch((error) => logger.error('Offline handler failed', error));
  }
}

/** After a restart nobody is connected yet */
export async function resetPresence() {
  await User.updateMany({ isOnline: true }, { isOnline: false });
}
