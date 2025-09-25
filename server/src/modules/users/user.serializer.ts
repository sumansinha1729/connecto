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

/** The logged-in user's own profile. Matches `Me` in mobile/src/types. */
export interface MeUser extends PublicUser {
  phone: string;
  profileComplete: boolean;
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

export function toMe(user: UserDoc): MeUser {
  return { ...toPublicUser(user), phone: user.phone, profileComplete: user.profileComplete };
}
