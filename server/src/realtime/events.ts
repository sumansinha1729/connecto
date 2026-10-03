/**
 * Server → client socket events. Actions go over REST; the socket only pushes
 * updates. Mirrors `ServerEvents` in mobile/src/services/realtime.ts.
 */
import type { RoomDto, RoomMessageDto } from '../modules/rooms/rooms.service';
import type { PublicUser } from '../modules/users/user.serializer';

/** What the app needs to join an Agora voice channel. Null when Agora isn't configured. */
export interface VoiceCredentials {
  appId: string;
  channel: string;
  token: string;
  uid: number;
  expiresInSec: number;
  /** Publisher (can talk) or listen-only. The app follows this, not the room role, so the two can't disagree. */
  canSpeak: boolean;
}

/** Reasons are worded from the receiving user's point of view */
export type CallEndReason =
  | 'hangup'
  | 'peer_hangup'
  | 'rejected'
  | 'no_answer'
  | 'busy'
  | 'cancelled'
  | 'insufficient_balance';

export interface ServerToClientEvents {
  /** Your own account changed (e.g. listener application approved) — refresh `GET /users/me` */
  'account:updated': (payload: { reason: 'listener_approved' | 'listener_rejected' | 'listener_revoked' }) => void;
  'call:incoming': (payload: { callId: string; from: PublicUser; expiresAt: string }) => void;
  'call:accepted': (payload: { callId: string; voice: VoiceCredentials | null }) => void;
  /** coins = what the caller spent; earnedPaise = what the listener earned */
  'call:ended': (payload: { callId: string; reason: CallEndReason; durationSec: number; coins: number; earnedPaise: number }) => void;
  'wallet:balance': (payload: { balance: number }) => void;
  /** Listener earnings balance changed */
  'earnings:balance': (payload: { balancePaise: number }) => void;
  'room:updated': (payload: { room: RoomDto }) => void;
  /** Fresh voice credentials after your room role changed (speaker ↔ listener) */
  'room:voice': (payload: { roomId: string; voice: VoiceCredentials | null }) => void;
  /** Chat message, "X joined", or a system note like "X is now the host" */
  'room:message': (payload: { roomId: string; message: RoomMessageDto }) => void;
  'room:message-deleted': (payload: { roomId: string; messageId: string }) => void;
  /** Someone tapped an emoji reaction (not stored) */
  'room:reaction': (payload: { roomId: string; userId: string; emoji: string }) => void;
  /** The host or a co-host muted you */
  'room:muted': (payload: { roomId: string; by: string }) => void;
  'room:closed': (payload: { roomId: string }) => void;
  'room:removed': (payload: { roomId: string }) => void;
}

export type ClientToServerEvents = Record<string, never>;

export interface SocketData {
  userId: string;
}
