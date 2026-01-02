/** Shapes returned by the server's /admin API (server/src/modules/admin). */
import type { CallRecord, Me, Payout, Transaction } from './index';

export interface AdminUser extends Me {
  status: 'active' | 'banned' | 'deleted';
  banReason: string | null;
  bannedAt: string | null;
  lastSeenAt: string | null;
  payoutMethod: { kind: 'upi' | 'bank'; upiId: string | null; accountName: string | null; accountNumber: string | null; ifsc: string | null } | null;
}

export interface AdminPayout extends Payout {
  method: { kind: 'upi' | 'bank'; upiId: string | null; accountName: string | null; accountNumber: string | null; ifsc: string | null };
  listener: { id: string; name: string; avatar: string; phone: string } | null;
}

export interface AdminStats {
  users: { total: number; new24h: number; banned: number; onlineNow: number };
  listeners: { approved: number; availableNow: number; pendingApplications: number };
  calls: { activeNow: number; completed24h: number; minutes24h: number; coinsCharged24h: number };
  revenue: { recharges24h: number; inr24h: number; coins24h: number };
  reports: { open: number };
  rooms: { live: number };
  payouts: { pending: number; pendingPaise: number };
  listenerEarnings24hPaise: number;
}

export interface UserCard {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  status: AdminUser['status'];
}

export interface AdminReport {
  id: string;
  reason: string;
  details: string;
  status: 'open' | 'reviewed' | 'actioned';
  createdAt: string;
  resolutionNote: string | null;
  reporter: UserCard | null;
  reported: UserCard | null;
  reportedOpenReports: number;
}

export interface AdminUserDetail {
  user: AdminUser;
  wallet: { balance: number; transactions: Transaction[] };
  earnings: { balancePaise: number; lifetimePaise: number; payouts: Payout[] };
  calls: CallRecord[];
  reports: {
    against: { id: string; reason: string; details: string; status: string; createdAt: string }[];
    madeCount: number;
  };
  auditLog: { action: string; adminId: string; details: Record<string, unknown>; createdAt: string }[];
}
