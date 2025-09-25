import { MIN_AGE } from '@/constants/config';
import type { Gender, Me, ProfileUpdate } from '@/types';

/** Editable form state shared by onboarding and the edit-profile screen */
export interface ProfileDraft {
  avatar: string;
  name: string;
  age: string;
  gender: Gender | null;
  languages: string[];
  interests: string[];
  bio: string;
}

export function draftFromUser(user: Me): ProfileDraft {
  return {
    avatar: user.avatar,
    name: user.name,
    age: user.age ? String(user.age) : '',
    gender: user.gender,
    languages: user.languages,
    interests: user.interests,
    bio: user.bio,
  };
}

export function draftToUpdate(draft: ProfileDraft): ProfileUpdate {
  return {
    avatar: draft.avatar,
    name: draft.name.trim(),
    age: Number(draft.age),
    gender: draft.gender,
    languages: draft.languages,
    interests: draft.interests,
    bio: draft.bio.trim(),
  };
}

export function validateBasics(draft: ProfileDraft): string | null {
  if (draft.name.trim().length < 2) return 'Enter a nickname with at least 2 characters.';
  const age = Number(draft.age);
  if (!Number.isInteger(age) || age < MIN_AGE || age > 99) return `You must be ${MIN_AGE} or older to use Connecto.`;
  if (!draft.gender) return 'Select your gender.';
  return null;
}

export function validatePreferences(draft: ProfileDraft): string | null {
  if (draft.languages.length === 0) return 'Pick at least one language you can talk in.';
  return null;
}
