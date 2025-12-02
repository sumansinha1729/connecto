import type { Server } from 'socket.io';

import type { ClientToServerEvents, ServerToClientEvents, SocketData } from './events';

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type EventName = keyof ServerToClientEvents;
type Payload<E extends EventName> = Parameters<ServerToClientEvents[E]>[0];

let io: IoServer | null = null;

export function setIo(server: IoServer | null) {
  io = server;
}

/** Every socket of a user joins this room, so all their devices get their events */
export const userChannel = (userId: string) => `user:${userId}`;
/** Sockets of everyone inside a voice room */
export const roomChannel = (roomId: string) => `room:${roomId}`;

export function emitToUser<E extends EventName>(userId: string, event: E, payload: Payload<E>) {
  io?.to(userChannel(userId)).emit(event, ...([payload] as Parameters<ServerToClientEvents[E]>));
}

export function emitToRoom<E extends EventName>(roomId: string, event: E, payload: Payload<E>) {
  io?.to(roomChannel(roomId)).emit(event, ...([payload] as Parameters<ServerToClientEvents[E]>));
}

export function addUserToRoomChannel(userId: string, roomId: string) {
  io?.in(userChannel(userId)).socketsJoin(roomChannel(roomId));
}

export function removeUserFromRoomChannel(userId: string, roomId: string) {
  io?.in(userChannel(userId)).socketsLeave(roomChannel(roomId));
}

/** Force-disconnects every socket of a user (e.g. when banned) */
export function disconnectUser(userId: string) {
  io?.in(userChannel(userId)).disconnectSockets(true);
}

export function closeRoomChannel(roomId: string) {
  io?.in(roomChannel(roomId)).socketsLeave(roomChannel(roomId));
}
