/** Admin-only endpoints */
import type { AdminPayout, AdminReport, AdminStats, AdminUser, AdminUserDetail } from '@/types/admin';
import { http } from './client';

export const adminApi = {
  getStats: () => http.get<AdminStats>('/admin/stats'),

  searchUsers: async (q: string) => (await http.get<{ users: AdminUser[] }>('/admin/users', { q, limit: 50 })).users,
  getUser: (userId: string) => http.get<AdminUserDetail>(`/admin/users/${userId}`),
  ban: (userId: string, reason: string) => http.post(`/admin/users/${userId}/ban`, { reason }),
  unban: (userId: string) => http.post(`/admin/users/${userId}/unban`),
  adjustWallet: (userId: string, amount: number, reason: string) =>
    http.post<{ balance: number }>(`/admin/users/${userId}/wallet-adjustment`, { amount, reason }),
  revokeListener: (userId: string, note: string) => http.post(`/admin/users/${userId}/revoke-listener`, { note }),

  listApplications: async () =>
    (await http.get<{ applications: AdminUser[] }>('/admin/listener-applications', { status: 'pending' })).applications,
  approveListener: (userId: string) => http.post(`/admin/listener-applications/${userId}/approve`),
  rejectListener: (userId: string, note: string) => http.post(`/admin/listener-applications/${userId}/reject`, { note }),

  listReports: async () => (await http.get<{ reports: AdminReport[] }>('/admin/reports', { status: 'open' })).reports,
  resolveReport: (reportId: string, input: { status: 'reviewed' | 'actioned'; note?: string; ban?: boolean }) =>
    http.post(`/admin/reports/${reportId}/resolve`, input),

  endRoom: (roomId: string) => http.post(`/admin/rooms/${roomId}/end`),

  listPayouts: async () => (await http.get<{ payouts: AdminPayout[] }>('/admin/payouts', { status: 'requested' })).payouts,
  markPayoutPaid: (payoutId: string, reference: string) => http.post(`/admin/payouts/${payoutId}/paid`, { reference }),
  rejectPayout: (payoutId: string, note: string) => http.post(`/admin/payouts/${payoutId}/reject`, { note }),
};
