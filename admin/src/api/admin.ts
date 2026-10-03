import { http } from './client';
import type {
  AdminMe,
  AdminPayout,
  AdminReport,
  AdminUser,
  AdminUserDetail,
  AuditEntry,
  Live,
  Metrics,
  Period,
  Safety,
  Stats,
} from './types';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AdminMe;
}

export const adminApi = {
  // Login (admins only; the server never creates accounts here)
  requestCode: (phone: string) => http.post<{ expiresInSec: number; devOtp?: string }>('/auth/admin/otp/request', { phone }),
  verifyCode: (phone: string, code: string) => http.post<LoginResult>('/auth/admin/otp/verify', { phone, code }),

  // Monitoring
  live: () => http.get<Live>('/admin/monitoring/live'),
  metrics: (period: Period) => http.get<Metrics>('/admin/monitoring/metrics', { period }),
  safety: () => http.get<Safety>('/admin/monitoring/safety'),
  stats: () => http.get<Stats>('/admin/stats'),

  // Users
  searchUsers: (query: { q?: string; status?: string; role?: string; listenerStatus?: string; page: number }) =>
    http.get<{ users: AdminUser[]; total: number; page: number }>('/admin/users', { ...query, limit: 30 }),
  user: (id: string) => http.get<AdminUserDetail>(`/admin/users/${id}`),
  ban: (id: string, reason: string) => http.post(`/admin/users/${id}/ban`, { reason }),
  unban: (id: string) => http.post(`/admin/users/${id}/unban`),
  adjustWallet: (id: string, amount: number, reason: string) =>
    http.post<{ balance: number }>(`/admin/users/${id}/wallet-adjustment`, { amount, reason }),
  revokeListener: (id: string, note: string) => http.post(`/admin/users/${id}/revoke-listener`, { note }),

  // Listener applications
  applications: (status: 'pending' | 'approved' | 'rejected') =>
    http.get<{ applications: AdminUser[] }>('/admin/listener-applications', { status, limit: 100 }),
  approve: (id: string) => http.post(`/admin/listener-applications/${id}/approve`),
  reject: (id: string, note: string) => http.post(`/admin/listener-applications/${id}/reject`, { note }),

  // Reports
  reports: (status: 'open' | 'reviewed' | 'actioned') => http.get<{ reports: AdminReport[] }>('/admin/reports', { status, limit: 100 }),
  resolveReport: (id: string, input: { status: 'reviewed' | 'actioned'; note?: string; ban?: boolean }) =>
    http.post(`/admin/reports/${id}/resolve`, input),

  // Payouts
  payouts: (status: 'requested' | 'paid' | 'rejected') => http.get<{ payouts: AdminPayout[] }>('/admin/payouts', { status, limit: 100 }),
  markPaid: (id: string, reference: string) => http.post(`/admin/payouts/${id}/paid`, { reference }),
  rejectPayout: (id: string, note: string) => http.post(`/admin/payouts/${id}/reject`, { note }),

  // Rooms & audit
  endRoom: (id: string) => http.post(`/admin/rooms/${id}/end`),
  auditLog: (page: number) => http.get<{ actions: AuditEntry[]; page: number }>('/admin/audit-log', { page, limit: 50 }),
};
