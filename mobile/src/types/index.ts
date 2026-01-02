export type Gender = 'male' | 'female' | 'other';
export type UserRole = 'user' | 'listener';

export interface User {
  id: string;
  name: string;
  gender: Gender | null;
  age: number | null;
  bio: string;
  languages: string[];
  interests: string[];
  /** Avatar identifier in the form "<style>:<seed>", see constants/avatars */
  avatar: string;
  role: UserRole;
  isOnline: boolean;
  /** Listener is accepting calls right now */
  isAvailable: boolean;
  rating: number;
  ratingCount: number;
  totalCalls: number;
  createdAt: string;
}

export type ListenerStatus = 'none' | 'pending' | 'approved' | 'rejected';

/** A listener application as the applicant sees it (the private details are admin-only) */
export interface ListenerApplication {
  fullName: string | null;
  /** YYYY-MM-DD */
  dateOfBirth: string | null;
  city: string | null;
  about: string | null;
  /** Signed, expiring link to play the voice intro */
  voiceIntroUrl: string | null;
  voiceIntroDurationSec: number | null;
  appliedAt: string | null;
  reviewedAt: string | null;
  /** Rejection reason */
  note: string | null;
}

export interface Me extends User {
  /** E.164, e.g. +919876543210 */
  phone: string;
  profileComplete: boolean;
  /** What they chose at signup: talk to listeners, or become one */
  signupIntent: 'user' | 'listener';
  /** Listener programme: apply → admin approves */
  listenerStatus: ListenerStatus;
  listenerApplication: ListenerApplication;
  /** Masked, e.g. "UPI · name@okicici" */
  payoutMethodLabel: string | null;
  isAdmin: boolean;
}

export interface ListenerApplicationInput {
  fullName: string;
  dateOfBirth: string;
  city: string;
  about: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** What the app needs to join an Agora voice channel (null until Agora is configured) */
export interface VoiceCredentials {
  appId: string;
  channel: string;
  token: string;
  uid: number;
  expiresInSec: number;
}

export type ProfileUpdate = Partial<
  Pick<User, 'name' | 'gender' | 'age' | 'bio' | 'languages' | 'interests' | 'avatar' | 'isAvailable'>
>;

export interface UserFilters {
  listenersOnly?: boolean;
  onlineOnly?: boolean;
  language?: string | null;
  gender?: Gender | null;
}

// ---------- Calls ----------

export type CallDirection = 'outgoing' | 'incoming';
export type CallStatus = 'completed' | 'missed' | 'rejected' | 'cancelled';
export type CallEndReason =
  | 'hangup'
  | 'peer_hangup'
  | 'rejected'
  | 'no_answer'
  | 'busy'
  | 'cancelled'
  | 'insufficient_balance';

export interface CallRecord {
  id: string;
  peer: User;
  direction: CallDirection;
  status: CallStatus;
  startedAt: string;
  durationSec: number;
  /** Coins the caller spent (outgoing calls) */
  coins: number;
  /** ₹ the listener earned, in paise (incoming calls) */
  earnedPaise: number;
  rating: number | null;
}

// ---------- Rooms ----------

export type RoomRole = 'host' | 'speaker' | 'listener';

export interface RoomParticipant {
  user: User;
  role: RoomRole;
  isMuted: boolean;
  handRaised: boolean;
}

export interface Room {
  id: string;
  title: string;
  topic: string;
  language: string;
  hostId: string;
  participants: RoomParticipant[];
  createdAt: string;
}

export interface CreateRoomInput {
  title: string;
  topic: string;
  language: string;
}

// ---------- Wallet ----------

export type TransactionType = 'signup_bonus' | 'recharge' | 'call_charge' | 'call_earning' | 'refund' | 'adjustment';

export interface Transaction {
  id: string;
  type: TransactionType;
  /** Signed amount: positive for credit, negative for debit */
  amount: number;
  description: string;
  createdAt: string;
}

export interface Wallet {
  balance: number;
  transactions: Transaction[];
}

export interface RechargePack {
  id: string;
  coins: number;
  bonus: number;
  priceInr: number;
  popular?: boolean;
}

// ---------- Safety ----------

export type ReportReason =
  | 'harassment'
  | 'abusive_language'
  | 'sexual_content'
  | 'spam'
  | 'underage'
  | 'other';

// ---------- Listener earnings ----------

export interface EarningsEntry {
  id: string;
  type: 'call' | 'payout' | 'payout_reversal' | 'adjustment';
  /** Signed, in paise */
  amountPaise: number;
  description: string;
  createdAt: string;
}

export interface Payout {
  id: string;
  amountPaise: number;
  status: 'requested' | 'paid' | 'rejected';
  methodLabel: string;
  reference: string | null;
  note: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface EarningsSummary {
  balancePaise: number;
  lifetimePaise: number;
  todayPaise: number;
  weekPaise: number;
  callsToday: number;
  minutesToday: number;
  entries: EarningsEntry[];
  payouts: Payout[];
  settings: { ratePaisePerMin: number; minWithdrawalPaise: number; schedule: 'daily' | 'weekly' | 'monthly' };
}

export type PayoutMethodInput =
  | { kind: 'upi'; upiId: string; accountName: string }
  | { kind: 'bank'; accountName: string; accountNumber: string; ifsc: string };
