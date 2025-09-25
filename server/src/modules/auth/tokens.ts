import jwt from 'jsonwebtoken';
import type { Types } from 'mongoose';

import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { randomToken, sha256 } from '../../utils/crypto';
import { logger } from '../../utils/logger';
import { User } from '../users/user.model';
import { Session } from './session.model';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Lifetime of the access token */
  expiresInSec: number;
}

export interface ClientMeta {
  ip?: string;
  userAgent?: string;
}

/** A refresh token revoked longer ago than this and used again is treated as stolen */
const REUSE_GRACE_MS = 30_000;

function signAccessToken(userId: string): string {
  return jwt.sign({ typ: 'access' }, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_TTL_SEC,
  });
}

export function verifyAccessToken(token: string): { userId: string } {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (payload.typ !== 'access' || !payload.sub) throw new Error('wrong token type');
    return { userId: payload.sub };
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please log in again.');
  }
}

/** Starts a new session (one per device) and returns its tokens. */
export async function createSession(userId: Types.ObjectId | string, meta: ClientMeta): Promise<AuthTokens> {
  const refreshToken = randomToken();
  await Session.create({
    userId,
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    ...meta,
  });
  return { accessToken: signAccessToken(String(userId)), refreshToken, expiresInSec: env.ACCESS_TOKEN_TTL_SEC };
}

/**
 * Exchanges a refresh token for a new pair (rotation). Each refresh token works once.
 * If an old, already-rotated token shows up again, someone else may have it, so every
 * session of that user is revoked.
 */
export async function rotateSession(refreshToken: string, meta: ClientMeta): Promise<AuthTokens> {
  const expired = ApiError.unauthorized('Your session has expired. Please log in again.');
  const now = new Date();
  const session = await Session.findOne({ tokenHash: sha256(refreshToken) });
  if (!session || session.expiresAt <= now) throw expired;

  if (session.revokedAt) {
    if (now.getTime() - session.revokedAt.getTime() > REUSE_GRACE_MS) {
      logger.warn(`Refresh token reuse detected for user ${session.userId}, revoking all sessions`);
      await revokeAllSessions(session.userId);
    }
    throw expired;
  }

  // Atomic: if two refreshes race, only one wins
  const claimed = await Session.findOneAndUpdate({ _id: session._id, revokedAt: null }, { revokedAt: now });
  if (!claimed) throw expired;

  const user = await User.findById(session.userId);
  if (!user || user.status !== 'active') throw expired;

  return createSession(user._id, meta);
}

export async function revokeSession(refreshToken: string): Promise<void> {
  await Session.updateOne({ tokenHash: sha256(refreshToken), revokedAt: null }, { revokedAt: new Date() });
}

export async function revokeAllSessions(userId: Types.ObjectId | string): Promise<void> {
  await Session.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}
