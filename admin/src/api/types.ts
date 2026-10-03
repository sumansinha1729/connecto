/** Shapes returned by the server's admin API (server/src/modules/admin) */

export type Period = 'today' | '7d' | '30d';
export type AccountStatus = 'active' | 'banned' | 'deleted';
export type ListenerStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface Person {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  role?: 'user' | 'listener';
  status?: AccountStatus;
}

export interface AdminMe {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  isAdmin: boolean;
}

// ---------- Monitoring ----------

export interface LiveCall {
  id: string;
  caller: Person | null;
  listener: Person | null;
  startedAt: string;
  durationSec: number;
  coins: number;
  earnedPaise: number;
}

export interface Live {
  generatedAt: string;
  people: { usersOnline: number; listenersOnline: number; listenersAvailable: number; listenersInCall: number };
  calls: LiveCall[];
  ringing: LiveCall[];
  rooms: {
    id: string;
    title: string;
    topic: string;
    language: string;
    host: Person | null;
    participants: number;
    speakers: number;
    startedAt: string;
  }[];
}

export interface MetricsBucket {
  key: string;
  signups: number;
  calls: number;
  missedCalls: number;
  minutes: number;
  coinsSpent: number;
  listenerEarningsPaise: number;
  coinsBought: number;
  rechargeInr: number;
}

export interface Metrics {
  period: Period;
  since: string;
  totals: {
    signups: number;
    calls: number;
    minutes: number;
    answerRate: number | null;
    avgCallMinutes: number;
    coinsSpent: number;
    coinsBought: number;
    rechargeInr: number;
    listenerEarningsPaise: number;
    payoutsPaidPaise: number;
    payoutsPaidCount: number;
    payoutsPendingPaise: number;
    payoutsPendingCount: number;
  };
  pricing: { callRateCoinsPerMin: number; listenerEarningPaisePerMin: number };
  series: MetricsBucket[];
  busiestHours: { hour: number; calls: number }[];
  topListeners: { listener: Person | null; calls: number; minutes: number; earningsPaise: number; rating: number; ratingCount: number }[];
}

export interface Safety {
  openReports: number;
  reportsThisWeek: { reason: string; count: number }[];
  mostReported: { user: Person | null; openReports: number; lastReportAt: string }[];
  shortCallListeners: { listener: Person | null; calls: number; shortCalls: number; shortSharePct: number }[];
  lowRatedListeners: { listener: Person | null; rating: number; ratingCount: number }[];
  recentBans: { user: Person | null; reason: string | null; bannedAt: string | null }[];
  recentAdminActions: AuditEntry[];
}

export interface Stats {
  listeners: { pendingApplications: number };
  reports: { open: number };
  payouts: { pending: number; pendingPaise: number };
}

// ---------- Operations ----------

export interface ListenerApplication {
  fullName: string | null;
  dateOfBirth: string | null;
  city: string | null;
  about: string | null;
  voiceIntroUrl: string | null;
  voiceIntroDurationSec: number | null;
  appliedAt: string | null;
  reviewedAt: string | null;
  note: string | null;
}

export interface PayoutMethod {
  kind: 'upi' | 'bank';
  upiId: string | null;
  accountName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
}

export interface AdminUser {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  gender: 'male' | 'female' | 'other' | null;
  age: number | null;
  bio: string;
  languages: string[];
  interests: string[];
  role: 'user' | 'listener';
  signupIntent: 'user' | 'listener';
  isAdmin: boolean;
  isOnline: boolean;
  isAvailable: boolean;
  rating: number;
  ratingCount: number;
  totalCalls: number;
  profileComplete: boolean;
  status: AccountStatus;
  banReason: string | null;
  bannedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  listenerStatus: ListenerStatus;
  listenerApplication: ListenerApplication;
  payoutMethod: PayoutMethod | null;
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

export interface AdminPayout extends Payout {
  method: PayoutMethod;
  listener: Person | null;
}

export interface AdminReport {
  id: string;
  reason: string;
  details: string;
  status: 'open' | 'reviewed' | 'actioned';
  createdAt: string;
  resolutionNote: string | null;
  reporter: Person | null;
  reported: Person | null;
  reportedOpenReports: number;
}

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

export interface CallRecord {
  id: string;
  peer: { id: string; name: string; avatar: string };
  direction: 'incoming' | 'outgoing';
  status: string;
  startedAt: string;
  durationSec: number;
  coins: number;
  earnedPaise: number;
  rating: number | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  admin: Person | null;
  target: Person | null;
  details: Record<string, unknown>;
  /** Monitoring uses `at`, the audit log uses `createdAt` */
  at?: string;
  createdAt?: string;
}

export interface AdminUserDetail {
  user: AdminUser;
  wallet: { balance: number; transactions: Transaction[] };
  earnings: { balancePaise: number; lifetimePaise: number; payouts: Payout[] };
  calls: CallRecord[];
  reports: { against: { id: string; reason: string; details: string; status: string; createdAt: string }[]; madeCount: number };
  auditLog: { action: string; adminId: string; details: Record<string, unknown>; createdAt: string }[];
}
