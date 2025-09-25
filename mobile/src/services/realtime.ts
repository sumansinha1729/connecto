/**
 * Server → client realtime events. In mock mode the mock backend emits these
 * directly; with the real backend they will be forwarded from Socket.IO.
 */
import type { CallEndReason, Room, User } from '@/types';

export interface ServerEvents {
  'call:incoming': { callId: string; from: User };
  'call:accepted': { callId: string };
  'call:ended': {
    callId: string;
    reason: CallEndReason;
    durationSec: number;
    coins: number;
  };
  'wallet:balance': { balance: number };
  'room:updated': { room: Room };
  'room:speaking': { roomId: string; userIds: string[] };
  'room:closed': { roomId: string };
  'room:removed': { roomId: string };
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
