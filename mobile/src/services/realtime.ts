/**
 * Server → client realtime events, forwarded from Socket.IO (see http/socket.ts).
 * Mirrors server/src/realtime/events.ts.
 */
import type { CallEndReason, Room, RoomMessage, User, VoiceCredentials } from '@/types';

export interface ServerEvents {
  'call:incoming': { callId: string; from: User; expiresAt?: string };
  'call:accepted': { callId: string; voice?: VoiceCredentials | null };
  'call:ended': {
    callId: string;
    reason: CallEndReason;
    durationSec: number;
    /** Coins the caller spent */
    coins: number;
    /** ₹ the listener earned, in paise */
    earnedPaise?: number;
  };
  'wallet:balance': { balance: number };
  'earnings:balance': { balancePaise: number };
  'room:updated': { room: Room };
  /** New voice credentials after your room role changed */
  'room:voice': { roomId: string; voice: VoiceCredentials | null };
  'room:message': { roomId: string; message: RoomMessage };
  'room:message-deleted': { roomId: string; messageId: string };
  /** Someone tapped an emoji reaction */
  'room:reaction': { roomId: string; userId: string; emoji: string };
  /** The host or a co-host muted you */
  'room:muted': { roomId: string; by: string };
  'room:closed': { roomId: string };
  'room:removed': { roomId: string };
  /** Your account changed on the server (e.g. listener application reviewed) */
  'account:updated': { reason: string };
}

type Handler<T> = (payload: T) => void;

class TypedEmitter<Events extends object> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler as Handler<never>);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.handlers.get(event)?.forEach((handler) => (handler as Handler<Events[K]>)(payload));
  }
}

export const realtime = new TypedEmitter<ServerEvents>();
