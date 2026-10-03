/**
 * Fills a development database with sample people: approved listeners and normal users.
 * Safe to run again (existing sample accounts are skipped). Never runs in production.
 *
 *   npm run seed                          20 listeners + 15 users
 *   npm run seed -- --listeners 30 --users 10
 *   npm run seed -- --reset               removes every sample account first
 *
 * Sample phones: listeners 6000000001…, users 6100000001…  Log in as any of them with the dev OTP.
 */
import crypto from 'node:crypto';

import mongoose from 'mongoose';

import { env } from '../config/env';
import { INTERESTS, LANGUAGES } from '../config/options';
import { Session } from '../modules/auth/session.model';
import { Call } from '../modules/calls/call.model';
import { EarningsAccount, EarningsEntry, PayoutRequest } from '../modules/earnings/earnings.model';
import { Block, Favorite, Report } from '../modules/users/relations.model';
import { User } from '../modules/users/user.model';
import { Transaction, Wallet } from '../modules/wallet/wallet.model';
import { credit } from '../modules/wallet/wallet.service';
import { randomAvatar } from '../utils/avatar';

const SAMPLE_PHONES = /^\+91(60|61)\d{8}$/;
const listenerPhone = (i: number) => `+9160${String(i).padStart(8, '0')}`;
const userPhone = (i: number) => `+9161${String(i).padStart(8, '0')}`;

const FEMALE = [
  'Ananya',
  'Priya',
  'Sneha',
  'Kavya',
  'Isha',
  'Riya',
  'Meera',
  'Diya',
  'Pooja',
  'Nisha',
  'Tanvi',
  'Aditi',
  'Shreya',
  'Neha',
  'Simran',
  'Zara',
  'Lakshmi',
  'Anjali',
];
const MALE = [
  'Rahul',
  'Arjun',
  'Rohan',
  'Vikram',
  'Aman',
  'Karan',
  'Siddharth',
  'Aditya',
  'Nikhil',
  'Varun',
  'Kabir',
  'Imran',
  'Harsh',
  'Dev',
  'Yash',
  'Manish',
  'Suresh',
  'Ravi',
];
const NICK_SUFFIX = ['', '', '', '_here', '.calm', '_talks', '_listens', '99', '_x', '_vibes'];
const CITIES = [
  'Mumbai',
  'Delhi',
  'Bengaluru',
  'Kolkata',
  'Pune',
  'Hyderabad',
  'Chennai',
  'Jaipur',
  'Lucknow',
  'Ahmedabad',
  'Indore',
  'Bhopal',
  'Kochi',
  'Chandigarh',
];
const LISTENER_BIOS = [
  'Here to listen, no judgement. Let’s talk it out.',
  'Psychology student. Your feelings are valid.',
  'Late-night talks, career worries, breakups — I’m all ears.',
  'Calm voice, patient listener. Tell me about your day.',
  'Been through tough times too. Happy to help you feel lighter.',
  'Music lover and good listener. Chai and conversations!',
  'Overthinker? Same. Let’s untangle it together.',
  'Former helpline volunteer. Safe space, always.',
];
const USER_BIOS = ['Just want someone to talk to.', 'New here 👋', 'Work stress is real.', 'Night owl.', 'Cricket and movies.', ''];
const ABOUTS = [
  'I volunteered on a student helpline for two years and love helping people feel heard.',
  'Friends always come to me with their problems. I listen without judging.',
  'I have been through a breakup and stress at work, so I understand how lonely it can feel.',
  'I am studying psychology and want to support people who need someone to talk to.',
];

const pick = <T>(list: readonly T[]): T => list[crypto.randomInt(list.length)];
const pickSome = <T>(list: readonly T[], min: number, max: number): T[] =>
  [...list].sort(() => Math.random() - 0.5).slice(0, min + crypto.randomInt(max - min + 1));
const between = (min: number, max: number) => min + Math.random() * (max - min);

function person() {
  const gender: 'female' | 'male' = Math.random() < 0.6 ? 'female' : 'male';
  const first = pick(gender === 'female' ? FEMALE : MALE);
  // Hindi or English almost always, plus maybe a regional language
  const languages = [...new Set([pick(['Hindi', 'English'] as const), ...pickSome(LANGUAGES, 0, 2)])].slice(0, 3);
  return { gender, first, name: `${first}${pick(NICK_SUFFIX)}`, languages, interests: pickSome(INTERESTS, 2, 4) };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const number = (flag: string, fallback: number) => {
    const i = args.indexOf(flag);
    const value = i >= 0 ? Number(args[i + 1]) : fallback;
    if (!Number.isInteger(value) || value < 0 || value > 500) throw new Error(`${flag} must be a number from 0 to 500`);
    return value;
  };
  return { listeners: number('--listeners', 20), users: number('--users', 15), reset: args.includes('--reset') };
}

async function reset() {
  const ids = (await User.find({ phone: SAMPLE_PHONES }, { _id: 1 }).lean()).map((u) => u._id);
  const byUser = { userId: { $in: ids } };
  await Promise.all([
    Wallet.deleteMany(byUser),
    Transaction.deleteMany(byUser),
    EarningsAccount.deleteMany(byUser),
    EarningsEntry.deleteMany(byUser),
    PayoutRequest.deleteMany(byUser),
    Session.deleteMany(byUser),
    Call.deleteMany({ $or: [{ callerId: { $in: ids } }, { calleeId: { $in: ids } }] }),
    Favorite.deleteMany({ $or: [{ userId: { $in: ids } }, { targetId: { $in: ids } }] }),
    Block.deleteMany({ $or: [{ userId: { $in: ids } }, { targetId: { $in: ids } }] }),
    Report.deleteMany({ $or: [{ reporterId: { $in: ids } }, { userId: { $in: ids } }] }),
  ]);
  await User.deleteMany({ _id: { $in: ids } });
  console.log(`Removed ${ids.length} sample accounts.`);
}

async function createSample(phone: string, listener: boolean): Promise<string | null> {
  if (await User.exists({ phone })) return null;
  const p = person();
  const age = Math.round(between(19, 34));
  const ratingCount = listener ? crypto.randomInt(5, 220) : 0;
  const rating = listener ? Math.round(between(3.9, 5) * 10) / 10 : 0;
  const dob = new Date(Date.UTC(new Date().getUTCFullYear() - age, crypto.randomInt(12), 1 + crypto.randomInt(28)));

  const user = await User.create({
    phone,
    name: p.name,
    gender: p.gender,
    age,
    bio: pick(listener ? LISTENER_BIOS : USER_BIOS),
    languages: p.languages,
    interests: p.interests,
    avatar: randomAvatar(),
    role: listener ? 'listener' : 'user',
    signupIntent: listener ? 'listener' : 'user',
    // Most listeners are taking calls; they show as online only while logged in
    isAvailable: listener && Math.random() < 0.8,
    lastSeenAt: new Date(Date.now() - crypto.randomInt(5 * 24 * 3600) * 1000),
    rating,
    ratingSum: Math.round(rating * ratingCount),
    ratingCount,
    totalCalls: listener ? ratingCount + crypto.randomInt(0, 80) : crypto.randomInt(0, 15),
    ...(listener
      ? {
          listenerStatus: 'approved' as const,
          listenerApplication: {
            fullName: `${p.first} ${pick(['Sharma', 'Verma', 'Iyer', 'Das', 'Patel', 'Khan', 'Reddy', 'Nair', 'Singh', 'Gupta'])}`,
            dateOfBirth: dob,
            city: pick(CITIES),
            about: pick(ABOUTS),
            appliedAt: new Date(Date.now() - crypto.randomInt(10, 60) * 24 * 3600 * 1000),
            reviewedAt: new Date(Date.now() - crypto.randomInt(1, 9) * 24 * 3600 * 1000),
            note: 'Sample listener',
          },
        }
      : {}),
  });
  await credit({
    userId: user._id,
    amount: env.SIGNUP_BONUS_COINS,
    type: 'signup_bonus',
    description: 'Welcome bonus',
    idempotencyKey: `signup-bonus:${user.id}`,
  });
  return `${user.name} (${phone.slice(3)})`;
}

async function main() {
  if (env.isProduction) {
    console.error('Refusing to seed a production database.');
    process.exit(1);
  }
  const { listeners, users, reset: shouldReset } = parseArgs();
  await mongoose.connect(env.MONGO_URI);
  if (shouldReset) await reset();

  const created = { listeners: [] as string[], users: [] as string[] };
  for (let i = 1; i <= listeners; i++) {
    const name = await createSample(listenerPhone(i), true);
    if (name) created.listeners.push(name);
  }
  for (let i = 1; i <= users; i++) {
    const name = await createSample(userPhone(i), false);
    if (name) created.users.push(name);
  }

  console.log(`Database: ${mongoose.connection.name}`);
  if (listeners) console.log(`Added ${created.listeners.length} listeners: ${created.listeners.join(', ') || '(already there)'}`);
  if (users) console.log(`Added ${created.users.length} users: ${created.users.join(', ') || '(already there)'}`);
  console.log('Log in as any of them with OTP', env.DEV_OTP ?? '(set DEV_OTP in .env)');
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
