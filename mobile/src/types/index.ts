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

export interface Me extends User {
  phone: string;
  profileComplete: boolean;
}

export type ProfileUpdate = Partial<
  Pick<User, 'name' | 'gender' | 'age' | 'bio' | 'languages' | 'interests' | 'avatar' | 'role' | 'isAvailable'>
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
  /** Coins spent (outgoing) or earned (incoming, listeners only) */
  coins: number;
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

export type TransactionType = 'signup_bonus' | 'recharge' | 'call_charge' | 'call_earning';

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
