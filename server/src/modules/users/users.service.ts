import { Types } from 'mongoose';

import { env } from '../../config/env';
import { MIN_AGE, type REPORT_REASONS } from '../../config/options';
import { ApiError } from '../../utils/ApiError';
import { revokeAllSessions } from '../auth/tokens';
import { storage } from '../storage/storage';
import { assertActsAsUser, isListener } from './accountRules';
import { Block, Favorite, Report } from './relations.model';
import { User, type UserDoc } from './user.model';
import { toPublicUser } from './user.serializer';

type Id = Types.ObjectId | string;

// ---------- Blocking ----------

/** Ids of everyone this user has blocked or been blocked by */
export async function getBlockedIds(userId: Id): Promise<Types.ObjectId[]> {
  const rows = await Block.find({ $or: [{ userId }, { targetId: userId }] }, { userId: 1, targetId: 1 }).lean();
  const me = String(userId);
  return rows.map((r) => (String(r.userId) === me ? r.targetId : r.userId));
}

export async function isBlockedEitherWay(a: Id, b: Id): Promise<boolean> {
  return Boolean(
    await Block.exists({
      $or: [
        { userId: a, targetId: b },
        { userId: b, targetId: a },
      ],
    }),
  );
}

/** Another user who is active and not blocked either way, or 404 */
async function getVisibleUser(me: UserDoc, targetId: string): Promise<UserDoc> {
  if (me.id === targetId) throw ApiError.badRequest('You can’t do that to yourself.');
  const target = await User.findOne({ _id: targetId, status: 'active' });
  if (!target || (await isBlockedEitherWay(me._id, target._id))) throw ApiError.notFound('This user is not available.');
  return target;
}

// ---------- Profile ----------

export interface ProfileUpdate {
  name?: string;
  gender?: 'male' | 'female' | 'other';
  age?: number;
  bio?: string;
  languages?: string[];
  interests?: string[];
  avatar?: string;
  /** Listeners only: accepting calls right now */
  isAvailable?: boolean;
}

export async function updateProfile(user: UserDoc, update: ProfileUpdate): Promise<UserDoc> {
  if (update.isAvailable !== undefined && !isListener(user)) {
    throw ApiError.forbidden('Only listeners can go available for calls.');
  }
  user.set(update);
  await user.save();
  return user;
}

/**
 * The choice on the first screen after signup ("I want to talk" / "I want to be a
 * listener"), or "continue as a normal user" after a listener application.
 */
export async function setSignupIntent(user: UserDoc, intent: 'user' | 'listener'): Promise<UserDoc> {
  if (isListener(user)) throw ApiError.badRequest('You are already a listener.');
  if (intent === 'listener') {
    if (user.profileComplete && user.signupIntent === 'user') {
      throw ApiError.badRequest('Apply from your profile to become a listener.');
    }
    user.signupIntent = 'listener';
  } else {
    user.signupIntent = 'user';
    // Choosing to be a normal user withdraws a pending application
    if (user.listenerStatus === 'pending') user.listenerStatus = 'none';
  }
  await user.save();
  return user;
}

// ---------- Listener applications ----------

const VOICE_FORMATS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};
/** Allow a little slack: recorders on different phones round the length differently */
const DURATION_SLACK_SEC = 2;

function assertCanEditApplication(user: UserDoc) {
  if (isListener(user)) throw ApiError.badRequest('You are already an approved listener.');
}

/** Saves (or replaces) the applicant's voice intro recording */
export async function uploadVoiceIntro(user: UserDoc, data: Buffer, contentType: string, durationSec: number) {
  assertCanEditApplication(user);
  const extension = VOICE_FORMATS[contentType.split(';')[0].trim().toLowerCase()];
  if (!extension) throw ApiError.badRequest('Unsupported audio format. Please record again.');
  if (data.length < 1024) throw ApiError.badRequest('The recording is empty. Please record again.');
  if (
    !Number.isFinite(durationSec) ||
    durationSec < env.VOICE_INTRO_MIN_SEC - DURATION_SLACK_SEC ||
    durationSec > env.VOICE_INTRO_MAX_SEC + DURATION_SLACK_SEC
  ) {
    throw ApiError.badRequest(`Your voice intro must be ${env.VOICE_INTRO_MIN_SEC}–${env.VOICE_INTRO_MAX_SEC} seconds long.`);
  }

  const key = `voice-intro_${user.id}_${Date.now()}.${extension}`;
  await storage.put(key, data, contentType);
  const previous = user.listenerApplication?.voiceIntroKey;
  user.set({ 'listenerApplication.voiceIntroKey': key, 'listenerApplication.voiceIntroDurationSec': Math.round(durationSec) });
  await user.save();
  if (previous) await storage.delete(previous).catch(() => {});
  return user;
}

export interface ListenerApplicationInput {
  fullName: string;
  /** YYYY-MM-DD */
  dateOfBirth: string;
  city: string;
  about: string;
}

export function ageOn(dateOfBirth: Date, today = new Date()): number {
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const birthdayPassed =
    today.getUTCMonth() > dateOfBirth.getUTCMonth() ||
    (today.getUTCMonth() === dateOfBirth.getUTCMonth() && today.getUTCDate() >= dateOfBirth.getUTCDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

/** Sends (or re-sends after edits or a rejection) the application for admin review */
export async function submitListenerApplication(user: UserDoc, input: ListenerApplicationInput) {
  assertCanEditApplication(user);
  if (!user.name || !user.gender || user.languages.length === 0) {
    throw ApiError.badRequest('Add your nickname, gender and languages first.');
  }
  if (!user.listenerApplication?.voiceIntroKey) throw ApiError.badRequest('Record your voice intro first.');

  const dateOfBirth = new Date(`${input.dateOfBirth}T00:00:00Z`);
  const age = ageOn(dateOfBirth);
  if (Number.isNaN(age) || age > 100) throw ApiError.badRequest('Enter a valid date of birth.');
  if (age < MIN_AGE) throw ApiError.badRequest(`Listeners must be ${MIN_AGE} or older.`);

  user.set({
    age,
    listenerStatus: 'pending',
    'listenerApplication.fullName': input.fullName.trim(),
    'listenerApplication.dateOfBirth': dateOfBirth,
    'listenerApplication.city': input.city.trim(),
    'listenerApplication.about': input.about.trim(),
    'listenerApplication.appliedAt': new Date(),
    'listenerApplication.reviewedAt': null,
    'listenerApplication.reviewedBy': null,
    'listenerApplication.note': null,
  });
  await user.save();
  return user;
}

/**
 * Soft delete: the profile disappears and the phone number is freed so the
 * person can sign up again. Ledger and reports are kept for accounting/safety.
 */
export async function deleteAccount(user: UserDoc): Promise<void> {
  user.set({
    status: 'deleted',
    phone: `deleted:${user.id}:${Date.now()}`,
    name: 'Deleted user',
    bio: '',
    isOnline: false,
    isAvailable: false,
  });
  await user.save();
  await Promise.all([
    revokeAllSessions(user._id),
    Favorite.deleteMany({ $or: [{ userId: user._id }, { targetId: user._id }] }),
    Block.deleteMany({ userId: user._id }),
  ]);
}

// ---------- Discover ----------

export interface UserFilters {
  listenersOnly?: boolean;
  onlineOnly?: boolean;
  language?: string;
  gender?: string;
  page: number;
  limit: number;
}

/** Users browse listeners (the only people they can call) */
export async function listUsers(me: UserDoc, filters: UserFilters) {
  assertActsAsUser(me, 'browse listeners');
  const blocked = await getBlockedIds(me._id);
  const query: Record<string, unknown> = {
    _id: { $nin: [me._id, ...blocked] },
    status: 'active',
    profileComplete: true,
    role: 'listener',
    listenerStatus: 'approved',
  };
  if (filters.onlineOnly) query.isOnline = true;
  if (filters.language) query.languages = filters.language;
  if (filters.gender) query.gender = filters.gender;

  const users = await User.find(query)
    // Online and available first, then best rated
    .sort({ isOnline: -1, isAvailable: -1, rating: -1, _id: 1 })
    .skip((filters.page - 1) * filters.limit)
    .limit(filters.limit);
  return users.map(toPublicUser);
}

export async function getUserProfile(me: UserDoc, targetId: string) {
  const target = await getVisibleUser(me, targetId);
  const isFavorite = Boolean(await Favorite.exists({ userId: me._id, targetId: target._id }));
  return { ...toPublicUser(target), isFavorite };
}

// ---------- Favourites ----------

export async function listFavorites(me: UserDoc) {
  const [rows, blocked] = await Promise.all([
    Favorite.find({ userId: me._id }).sort({ createdAt: -1 }).lean(),
    getBlockedIds(me._id),
  ]);
  const blockedSet = new Set(blocked.map(String));
  const ids = rows.map((r) => r.targetId).filter((id) => !blockedSet.has(String(id)));
  const users = await User.find({ _id: { $in: ids }, status: 'active' });
  const byId = new Map(users.map((u) => [u.id, u]));
  // Keep the "most recently favourited first" order
  return ids.flatMap((id) => {
    const user = byId.get(String(id));
    return user ? [toPublicUser(user)] : [];
  });
}

export async function setFavorite(me: UserDoc, targetId: string, favorite: boolean): Promise<void> {
  if (!favorite) {
    await Favorite.deleteOne({ userId: me._id, targetId });
    return;
  }
  const target = await getVisibleUser(me, targetId);
  await Favorite.updateOne({ userId: me._id, targetId: target._id }, {}, { upsert: true });
}

// ---------- Blocks ----------

export async function listBlocked(me: UserDoc) {
  const rows = await Block.find({ userId: me._id }).sort({ createdAt: -1 }).lean();
  const users = await User.find({ _id: { $in: rows.map((r) => r.targetId) }, status: { $ne: 'deleted' } });
  return users.map(toPublicUser);
}

export async function setBlocked(me: UserDoc, targetId: string, blocked: boolean): Promise<void> {
  if (!blocked) {
    await Block.deleteOne({ userId: me._id, targetId });
    return;
  }
  if (me.id === targetId) throw ApiError.badRequest('You can’t block yourself.');
  const target = await User.findOne({ _id: targetId, status: { $ne: 'deleted' } });
  if (!target) throw ApiError.notFound('This user is not available.');

  await Block.updateOne({ userId: me._id, targetId: target._id }, {}, { upsert: true });
  await Favorite.deleteMany({
    $or: [
      { userId: me._id, targetId: target._id },
      { userId: target._id, targetId: me._id },
    ],
  });
}

// ---------- Reports ----------

const REPORT_DEDUPE_MS = 24 * 60 * 60 * 1000;

export async function reportUser(
  me: UserDoc,
  targetId: string,
  reason: (typeof REPORT_REASONS)[number],
  details: string,
): Promise<void> {
  if (me.id === targetId) throw ApiError.badRequest('You can’t report yourself.');
  const target = await User.findById(targetId);
  if (!target) throw ApiError.notFound('This user is not available.');

  // One open report per pair per day is enough for moderators
  const recent = await Report.exists({
    reporterId: me._id,
    userId: target._id,
    status: 'open',
    createdAt: { $gte: new Date(Date.now() - REPORT_DEDUPE_MS) },
  });
  if (recent) return;

  await Report.create({ reporterId: me._id, userId: target._id, reason, details: details.trim() });
}
