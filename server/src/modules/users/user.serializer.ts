import { storage } from '../storage/storage';
import type { UserDoc } from './user.model';

/** What other users can see. Matches `User` in mobile/src/types. */
export interface PublicUser {
  id: string;
  name: string;
  gender: string | null;
  age: number | null;
  bio: string;
  languages: string[];
  interests: string[];
  avatar: string;
  role: 'user' | 'listener';
  isOnline: boolean;
  isAvailable: boolean;
  rating: number;
  ratingCount: number;
  totalCalls: number;
  createdAt: string;
}

/** A listener application as the applicant (and admins) see it */
export interface ListenerApplicationDto {
  fullName: string | null;
  /** YYYY-MM-DD */
  dateOfBirth: string | null;
  city: string | null;
  about: string | null;
  voiceIntroUrl: string | null;
  voiceIntroDurationSec: number | null;
  appliedAt: string | null;
  reviewedAt: string | null;
  /** Rejection reason shown to the applicant */
  note: string | null;
}

/** The logged-in user's own profile. Matches `Me` in mobile/src/types. */
export interface MeUser extends PublicUser {
  phone: string;
  profileComplete: boolean;
  signupIntent: 'user' | 'listener';
  /** none → pending → approved / rejected */
  listenerStatus: string;
  listenerApplication: ListenerApplicationDto;
  /** Masked, e.g. "UPI · suman@okicici" or "Bank · ••••4321" */
  payoutMethodLabel: string | null;
  isAdmin: boolean;
}

export function toPublicUser(user: UserDoc): PublicUser {
  return {
    id: user.id,
    name: user.name,
    gender: user.gender ?? null,
    age: user.age ?? null,
    bio: user.bio,
    languages: user.languages,
    interests: user.interests,
    avatar: user.avatar,
    role: user.role as PublicUser['role'],
    isOnline: user.isOnline,
    isAvailable: user.isAvailable,
    rating: user.rating,
    ratingCount: user.ratingCount,
    totalCalls: user.totalCalls,
    createdAt: user.createdAt.toISOString(),
  };
}

function toApplication(user: UserDoc): ListenerApplicationDto {
  const app = user.listenerApplication;
  return {
    fullName: app?.fullName ?? null,
    dateOfBirth: app?.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    city: app?.city ?? null,
    about: app?.about ?? null,
    voiceIntroUrl: app?.voiceIntroKey ? storage.getDownloadUrl(app.voiceIntroKey) : null,
    voiceIntroDurationSec: app?.voiceIntroDurationSec ?? null,
    appliedAt: app?.appliedAt?.toISOString() ?? null,
    reviewedAt: app?.reviewedAt?.toISOString() ?? null,
    note: app?.note ?? null,
  };
}

export function payoutMethodLabel(user: UserDoc): string | null {
  const method = user.payoutMethod;
  if (method?.kind === 'upi' && method.upiId) return `UPI · ${method.upiId}`;
  if (method?.kind === 'bank' && method.accountNumber) return `Bank · ••••${method.accountNumber.slice(-4)}`;
  return null;
}

export function toMe(user: UserDoc): MeUser {
  return {
    ...toPublicUser(user),
    phone: user.phone,
    profileComplete: user.profileComplete,
    signupIntent: user.signupIntent as MeUser['signupIntent'],
    listenerStatus: user.listenerStatus,
    listenerApplication: toApplication(user),
    payoutMethodLabel: payoutMethodLabel(user),
    isAdmin: user.isAdmin,
  };
}

/** Everything moderators need about an account, including private details */
export function toAdminUser(user: UserDoc) {
  const method = user.payoutMethod;
  return {
    ...toMe(user),
    status: user.status,
    banReason: user.banReason ?? null,
    bannedAt: user.bannedAt?.toISOString() ?? null,
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    payoutMethod: method?.kind
      ? {
          kind: method.kind,
          upiId: method.upiId ?? null,
          accountName: method.accountName ?? null,
          accountNumber: method.accountNumber ?? null,
          ifsc: method.ifsc ?? null,
        }
      : null,
  };
}
