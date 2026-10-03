import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { createApp } from './app';
import { endCallsOfOfflineUser, recoverCallsOnStartup, shutdownCalls } from './modules/calls/calls.service';
import { endRoomsOnStartup, leaveAllRooms } from './modules/rooms/rooms.service';
import { onUserOffline, resetPresence } from './realtime/presence';
import { initRealtime } from './realtime/socket';
import type { IoServer } from './realtime/io';

export interface RunningServer {
  server: http.Server;
  io: IoServer;
  port: number;
  /** Stops call timers, disconnects sockets and closes the HTTP server */
  close(): Promise<void>;
}

/**
 * Starts the HTTP + realtime server on an already connected database.
 * Used by `index.ts` (the real server) and by the automated tests.
 */
export async function startServer(port: number): Promise<RunningServer> {
  // Live state (presence, calls, rooms) can't survive a restart
  await resetPresence();
  await recoverCallsOnStartup();
  await endRoomsOnStartup();

  // When someone really goes offline: end their calls and take them out of rooms
  onUserOffline(endCallsOfOfflineUser);
  onUserOffline((userId) => leaveAllRooms(userId));

  const server = http.createServer(createApp());
  const io = initRealtime(server);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.off('error', reject);
      resolve();
    });
  });

  return {
    server,
    io,
    port: (server.address() as AddressInfo).port,
    close: () =>
      new Promise<void>((resolve) => {
        shutdownCalls();
        // Disconnects every socket, then closes the HTTP server (which also drops idle keep-alive connections)
        io.close(() => resolve());
      }),
  };
}
