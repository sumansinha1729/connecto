/**
 * Allowed values for user input. Kept in sync with mobile/src/constants/options.ts.
 */
export const LANGUAGES = [
  'Hindi',
  'English',
  'Bengali',
  'Tamil',
  'Telugu',
  'Marathi',
  'Kannada',
  'Malayalam',
  'Gujarati',
  'Punjabi',
  'Odia',
  'Urdu',
] as const;

export const INTERESTS = [
  'Breakups',
  'Career',
  'Stress',
  'Loneliness',
  'Relationships',
  'Family',
  'Movies',
  'Music',
  'Gaming',
  'Travel',
  'Cricket',
  'Fitness',
  'Books',
  'Spirituality',
  'Just chatting',
] as const;

export const GENDERS = ['male', 'female', 'other'] as const;

export const ROOM_TOPICS = [
  'Just chatting',
  'Breakups',
  'Career',
  'Stress',
  'Relationships',
  'Music',
  'Movies',
  'Cricket',
  'Late night talks',
] as const;

export const REPORT_REASONS = [
  'harassment',
  'abusive_language',
  'sexual_content',
  'spam',
  'underage',
  'other',
] as const;

export interface RechargePack {
  id: string;
  coins: number;
  bonus: number;
  priceInr: number;
  popular?: boolean;
}

export const RECHARGE_PACKS: RechargePack[] = [
  { id: 'pack_100', coins: 100, bonus: 0, priceInr: 49 },
  { id: 'pack_250', coins: 250, bonus: 25, priceInr: 99, popular: true },
  { id: 'pack_600', coins: 600, bonus: 100, priceInr: 199 },
  { id: 'pack_1500', coins: 1500, bonus: 300, priceInr: 449 },
];

export const MIN_AGE = 18;
export const MAX_LANGUAGES = 4;
export const MAX_INTERESTS = 5;
