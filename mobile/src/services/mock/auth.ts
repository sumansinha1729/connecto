import { DEV_OTP, SIGNUP_BONUS } from '@/constants/config';
import { randomAvatar } from '@/constants/avatars';
import type { AuthService } from '../contracts';
import { session } from '../session';
import { ApiError } from '@/utils/errors';
import { createId } from '@/utils/id';
import { getDb, persist, type DbUser } from './db';
import { addTransaction, adjustBalance, latency, toMe } from './helpers';

const PHONE_REGEX = /^[6-9]\d{9}$/;

export const mockAuth: AuthService = {
  async requestOtp(phone) {
    await latency(500, 900);
    if (!PHONE_REGEX.test(phone)) {
      throw new ApiError('INVALID_PHONE', 'Enter a valid 10-digit mobile number.');
    }
    const db = await getDb();
    db.otps[phone] = String(Math.floor(100000 + Math.random() * 900000));
    console.log(`[mock] OTP for ${phone}: ${db.otps[phone]} (or use ${DEV_OTP})`);
    return { devOtp: DEV_OTP };
  },

  async verifyOtp(phone, code) {
    await latency(500, 900);
    const db = await getDb();
    if (code !== DEV_OTP && code !== db.otps[phone]) {
      throw new ApiError('INVALID_OTP', 'That code is incorrect. Please try again.');
    }
    delete db.otps[phone];

    let user = Object.values(db.users).find((u) => u.phone === phone);
    const isNewUser = !user;
    if (!user) {
      const newUser: DbUser = {
        id: createId('u'),
        phone,
        name: '',
        gender: null,
        age: null,
        bio: '',
        languages: [],
        interests: [],
        avatar: randomAvatar(),
        role: 'user',
        isOnline: true,
        isAvailable: false,
        rating: 0,
        ratingCount: 0,
        totalCalls: 0,
        createdAt: new Date().toISOString(),
        profileComplete: false,
      };
      user = newUser;
      db.users[newUser.id] = newUser;
      adjustBalance(db, newUser.id, SIGNUP_BONUS);
      addTransaction(db, newUser.id, 'signup_bonus', SIGNUP_BONUS, 'Welcome bonus');
    }

    const token = createId('tok');
    db.sessions[token] = user.id;
    user.isOnline = true;
    persist();
    return { token, user: toMe(user), isNewUser };
  },

  async logout() {
    const db = await getDb();
    const token = session.getToken();
    if (token) {
      const user = db.users[db.sessions[token]];
      if (user) user.isOnline = false;
      delete db.sessions[token];
      persist();
    }
  },
};
