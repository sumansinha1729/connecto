import type { Gender, RechargePack, ReportReason } from '@/types';

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
];

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
];

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
];

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];

export const RECHARGE_PACKS: RechargePack[] = [
  { id: 'pack_100', coins: 100, bonus: 0, priceInr: 49 },
  { id: 'pack_250', coins: 250, bonus: 25, priceInr: 99, popular: true },
  { id: 'pack_600', coins: 600, bonus: 100, priceInr: 199 },
  { id: 'pack_1500', coins: 1500, bonus: 300, priceInr: 449 },
];

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'abusive_language', label: 'Abusive language' },
  { value: 'sexual_content', label: 'Sexual or inappropriate talk' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'underage', label: 'Seems under 18' },
  { value: 'other', label: 'Something else' },
];
