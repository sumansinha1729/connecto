/** Real backend implementation of the service contracts (server/ in this repo). */
import type { Api } from '../contracts';
import { getDeviceId } from '../device';
import { session } from '../session';
import type {
  ActiveCall,
  AuthTokens,
  CallRecord,
  EarningsSummary,
  ListenerProfile,
  Me,
  Room,
  RoomMessage,
  Transaction,
  User,
  VoiceCredentials,
} from '@/types';
import { http } from './client';
import { socketConnection } from './socket';

type WithFavorite = User & { isFavorite: boolean };
type LoginResponse = AuthTokens & { user: Me; isNewUser: boolean };

const toLogin = (data: LoginResponse) => ({
  tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken },
  user: data.user,
  isNewUser: data.isNewUser,
});

export const httpApi: Api = {
  auth: {
    requestOtp: (phone) => http.post('/auth/otp/request', { phone }, { auth: false }),
    verifyOtp: async (phone, code) => toLogin(await http.post<LoginResponse>('/auth/otp/verify', { phone, code }, { auth: false })),
    loginWithFirebase: async (idToken) => toLogin(await http.post<LoginResponse>('/auth/firebase', { idToken }, { auth: false })),

    async logout() {
      const refreshToken = session.getRefreshToken();
      if (refreshToken) await http.post('/auth/logout', { refreshToken }, { auth: false }).catch(() => {});
    },
  },

  users: {
    getMe: async () => (await http.get<{ user: Me }>('/users/me')).user,
    updateProfile: async (update) => (await http.patch<{ user: Me }>('/users/me', update)).user,
    setIntent: async (intent) => (await http.post<{ user: Me }>('/users/me/intent', { intent })).user,

    async uploadVoiceIntro(uri, durationSec) {
      // Works for web blob: URLs and native file:// URIs alike
      const blob = await (await fetch(uri)).blob();
      const contentType = blob.type || (uri.endsWith('.webm') ? 'audio/webm' : 'audio/mp4');
      const { user } = await http.upload<{ user: Me }>('/users/me/voice-intro', blob, contentType, {
        'X-Duration-Sec': String(durationSec),
      });
      return user;
    },

    submitListenerApplication: async (input) =>
      (await http.post<{ user: Me }>('/users/me/listener-application', input)).user,
    deleteAccount: () => http.delete('/users/me'),

    listUsers: async (filters) =>
      (
        await http.get<{ users: User[] }>('/users', {
          listenersOnly: filters.listenersOnly,
          onlineOnly: filters.onlineOnly,
          language: filters.language,
          gender: filters.gender,
        })
      ).users,

    async getProfile(userId) {
      const { user, listenerProfile } = await http.get<{ user: WithFavorite; listenerProfile: ListenerProfile | null }>(`/users/${userId}`);
      const { isFavorite, ...rest } = user;
      return { user: rest, isFavorite, listenerProfile };
    },

    listFavorites: async () => (await http.get<{ users: User[] }>('/users/me/favorites')).users,
    setFavorite: (userId, favorite) =>
      favorite ? http.put(`/users/${userId}/favorite`) : http.delete(`/users/${userId}/favorite`),
    listBlocked: async () => (await http.get<{ users: User[] }>('/users/me/blocked')).users,
    setBlocked: (userId, blocked) => (blocked ? http.put(`/users/${userId}/block`) : http.delete(`/users/${userId}/block`)),
    report: (userId, reason, details) => http.post(`/users/${userId}/report`, { reason, details }),
  },

  wallet: {
    getWallet: () => http.get<{ balance: number; transactions: Transaction[] }>('/wallet'),
    recharge: (packId) => http.post<{ balance: number; transactions: Transaction[] }>('/wallet/recharge', { packId }),
  },

  earnings: {
    getSummary: () => http.get<EarningsSummary>('/earnings'),
    setPayoutMethod: async (method) => (await http.put<{ user: Me }>('/earnings/payout-method', method)).user,
    withdraw: async () => {
      await http.post('/earnings/withdrawals', {});
    },
  },

  calls: {
    startCall: async (userId) => http.post<{ callId: string }>('/calls', { userId, deviceId: await getDeviceId() }),
    acceptCall: async (callId) => http.post<{ voice: VoiceCredentials | null }>(`/calls/${callId}/accept`, { deviceId: await getDeviceId() }),
    getActive: async () => (await http.get<{ call: ActiveCall | null }>('/calls/active')).call,
    rejectCall: (callId) => http.post(`/calls/${callId}/reject`),
    endCall: (callId) => http.post(`/calls/${callId}/end`),
    rateCall: (callId, stars) => http.post(`/calls/${callId}/rate`, { stars }),
    getVoice: async (callId) => (await http.get<{ voice: VoiceCredentials | null }>(`/calls/${callId}/voice`)).voice,
    getHistory: async (before) => (await http.get<{ calls: CallRecord[] }>('/calls/history', { limit: 30, before })).calls,
    findMatch: async (language) => (await http.post<{ user: User }>('/calls/match', language ? { language } : {})).user,
  },

  rooms: {
    listRooms: async () => (await http.get<{ rooms: Room[] }>('/rooms')).rooms,
    createRoom: async (input) => (await http.post<{ room: Room }>('/rooms', input)).room,
    joinRoom: (roomId) => http.post<{ room: Room; voice: VoiceCredentials | null; messages: RoomMessage[] }>(`/rooms/${roomId}/join`),
    updateRoom: (roomId, input) => http.patch(`/rooms/${roomId}`, input),
    leaveRoom: (roomId) => http.post(`/rooms/${roomId}/leave`),
    getVoice: async (roomId) => (await http.get<{ voice: VoiceCredentials | null }>(`/rooms/${roomId}/voice`)).voice,
    setHandRaised: (roomId, raised) => http.post(`/rooms/${roomId}/hand`, { raised }),
    setMuted: (roomId, muted) => http.post(`/rooms/${roomId}/mute`, { muted }),
    setRole: (roomId, userId, role) => http.put(`/rooms/${roomId}/participants/${userId}/role`, { role }),
    muteParticipant: (roomId, userId) => http.post(`/rooms/${roomId}/participants/${userId}/mute`),
    removeParticipant: (roomId, userId) => http.delete(`/rooms/${roomId}/participants/${userId}`),
    sendMessage: async (roomId, text) => (await http.post<{ message: RoomMessage }>(`/rooms/${roomId}/messages`, { text })).message,
    deleteMessage: (roomId, messageId) => http.delete(`/rooms/${roomId}/messages/${messageId}`),
    react: (roomId, emoji) => http.post(`/rooms/${roomId}/reactions`, { emoji }),
  },

  connection: socketConnection,
};
