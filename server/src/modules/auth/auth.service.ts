import { mongo } from 'mongoose';

import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { randomAvatar } from '../../utils/avatar';
import { hmac, randomDigits, safeEqual } from '../../utils/crypto';
import { normalizeIndianPhone } from '../../utils/phone';
import { User, type UserDoc } from '../users/user.model';
import { carryOverFromDeletedAccounts } from '../users/users.service';
import { toMe } from '../users/user.serializer';
import { credit } from '../wallet/wallet.service';
import { Otp } from './otp.model';
import { sms } from './sms';
import { createSession, type ClientMeta } from './tokens';

const OTP_LENGTH = 6;

function parsePhone(input: string): string {
  const phone = normalizeIndianPhone(input);
  if (!phone) throw ApiError.badRequest('Enter a valid 10-digit mobile number.', 'INVALID_PHONE');
  return phone;
}

const otpHash = (phone: string, code: string) => hmac(`otp:${phone}:${code}`);

export interface LoginOptions {
  /**
   * Admin panel login: codes are only sent to (and accepted for) active admins, and no
   * account is ever created. The response looks the same either way, so the admin panel
   * can't be used to find out which numbers are admins.
   */
  adminOnly?: boolean;
}

const isActiveAdmin = async (phone: string) => Boolean(await User.exists({ phone, isAdmin: true, status: 'active' }));

/**
 * Sends a login code. Limits: one code per OTP_RESEND_SEC, and at most
 * OTP_MAX_PER_WINDOW codes per OTP_WINDOW_SEC for each number.
 */
export async function requestOtp(phoneInput: string, meta: ClientMeta, { adminOnly = false }: LoginOptions = {}) {
  const phone = parsePhone(phoneInput);
  const now = Date.now();

  const recent = await Otp.find({ phone, createdAt: { $gte: new Date(now - env.OTP_WINDOW_SEC * 1000) } })
    .sort({ createdAt: -1 })
    .limit(env.OTP_MAX_PER_WINDOW)
    .lean();

  const last = recent[0];
  if (last) {
    const waitSec = Math.ceil((last.createdAt.getTime() + env.OTP_RESEND_SEC * 1000 - now) / 1000);
    if (waitSec > 0) throw ApiError.tooManyRequests(`Please wait ${waitSec}s before requesting a new code.`);
  }
  if (recent.length >= env.OTP_MAX_PER_WINDOW) {
    throw ApiError.tooManyRequests('Too many codes requested. Please try again in a few minutes.');
  }

  // Only the newest code is valid
  await Otp.updateMany({ phone, consumedAt: null }, { consumedAt: new Date(now) });

  // Not an admin: record the attempt (so limits still apply) but send nothing
  const silent = adminOnly && !(await isActiveAdmin(phone));

  const code = randomDigits(OTP_LENGTH);
  await Otp.create({
    phone,
    codeHash: otpHash(phone, code),
    expiresAt: new Date(now + env.OTP_TTL_SEC * 1000),
    ip: meta.ip,
  });
  if (!silent) await sms.sendOtp(phone, code);

  return {
    expiresInSec: env.OTP_TTL_SEC,
    resendInSec: env.OTP_RESEND_SEC,
    ...(env.devOtp && { devOtp: env.devOtp }),
  };
}

/** Checks the code, creates the account on first login (app only), and starts a session. */
export async function verifyOtp(phoneInput: string, code: string, meta: ClientMeta, { adminOnly = false }: LoginOptions = {}) {
  const phone = parsePhone(phoneInput);
  const now = new Date();

  const otp = await Otp.findOne({ phone, consumedAt: null, expiresAt: { $gt: now } }).sort({ createdAt: -1 });
  if (!otp) throw ApiError.badRequest('This code has expired. Please request a new one.', 'INVALID_OTP');

  const matches = (env.devOtp !== undefined && code === env.devOtp) || safeEqual(otp.codeHash, otpHash(phone, code));
  if (!matches) {
    const updated = await Otp.findOneAndUpdate({ _id: otp._id }, { $inc: { attempts: 1 } }, { returnDocument: 'after' });
    if (updated && updated.attempts >= env.OTP_MAX_ATTEMPTS) {
      await Otp.updateOne({ _id: otp._id }, { consumedAt: now });
      throw ApiError.badRequest('Too many wrong attempts. Please request a new code.', 'INVALID_OTP');
    }
    throw ApiError.badRequest('That code is incorrect. Please try again.', 'INVALID_OTP');
  }

  // Atomic consume, so the same code can't log in twice
  const consumed = await Otp.findOneAndUpdate({ _id: otp._id, consumedAt: null }, { consumedAt: now });
  if (!consumed) throw ApiError.badRequest('This code has already been used. Please request a new one.', 'INVALID_OTP');

  if (adminOnly) {
    const admin = await User.findOne({ phone, isAdmin: true, status: 'active' });
    if (!admin) throw ApiError.forbidden('This number doesn’t have admin access.');
    const tokens = await createSession(admin._id, meta);
    return { ...tokens, user: toMe(admin), isNewUser: false };
  }

  const { user, isNewUser } = await findOrCreateUser(phone);
  if (user.status === 'banned') throw ApiError.forbidden('Your account has been suspended. Contact support for help.');

  const tokens = await createSession(user._id, meta);
  return { ...tokens, user: toMe(user), isNewUser };
}

async function findOrCreateUser(phone: string): Promise<{ user: UserDoc; isNewUser: boolean }> {
  const existing = await User.findOne({ phone });
  if (existing) return { user: existing, isNewUser: false };

  try {
    const user = await User.create({ phone, avatar: randomAvatar() });
    // A number that had an account before keeps its blocks and gets no second welcome bonus
    const returning = await carryOverFromDeletedAccounts(user);
    if (env.SIGNUP_BONUS_COINS > 0 && !returning) {
      await credit({
        userId: user._id,
        amount: env.SIGNUP_BONUS_COINS,
        type: 'signup_bonus',
        description: 'Welcome bonus',
        idempotencyKey: `signup-bonus:${user.id}`,
      });
    }
    return { user, isNewUser: true };
  } catch (error) {
    // Two logins for a brand-new number raced: use the account the other one created
    if (error instanceof mongo.MongoServerError && error.code === 11000) {
      const user = await User.findOne({ phone });
      if (user) return { user, isNewUser: false };
    }
    throw error;
  }
}
