import { io, type Socket } from 'socket.io-client';

import { API_URL } from '@/constants/env';
import type { RealtimeConnection } from '../contracts';
import { realtime, type ServerEvents } from '../realtime';
import { session } from '../session';
import { refreshTokens } from './client';

/** Every server event, forwarded to `realtime`. A Record so TypeScript flags any event missing here. */
const FORWARDED: Record<keyof ServerEvents, true> = {
  'call:incoming': true,
  'call:accepted': true,
  'call:ended': true,
  'wallet:balance': true,
  'earnings:balance': true,
  'room:updated': true,
  'room:voice': true,
  'room:message': true,
  'room:message-deleted': true,
  'room:reaction': true,
  'room:muted': true,
  'room:closed': true,
  'room:removed': true,
  'account:updated': true,
};
const FORWARDED_EVENTS = Object.keys(FORWARDED) as (keyof ServerEvents)[];

let socket: Socket | null = null;

/**
 * Socket.IO connection to the backend. Being connected is also what makes
 * you "online" (callable) on the server. Every server event is forwarded to
 * the shared `realtime` emitter that the stores listen to.
 */
export const socketConnection: RealtimeConnection = {
  connect() {
    if (socket) return;
    socket = io(API_URL, {
      transports: ['websocket'],
      // A function, so every (re)connect sends the latest access token
      auth: (cb) => cb({ token: session.getAccessToken() }),
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });

    for (const event of FORWARDED_EVENTS) {
      socket.on(event, (payload: unknown) => realtime.emit(event, payload as never));
    }
    socket.on('connect', () => realtime.emit('connection:open', {}));

    // The server rejects expired tokens; refresh and try again
    socket.on('connect_error', async (error) => {
      if (error.message !== 'UNAUTHORIZED') return;
      const result = await refreshTokens();
      if (result === 'ok') socket?.connect();
      else if (result === 'expired') session.expired();
      else setTimeout(() => socket?.connect(), 5000);
    });
  },

  disconnect() {
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
  },
};
