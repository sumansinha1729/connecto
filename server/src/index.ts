import http from 'node:http';

import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { env } from './config/env';
import { endCallsOfOfflineUser, recoverCallsOnStartup, shutdownCalls } from './modules/calls/calls.service';
import { endRoomsOnStartup, leaveAllRooms } from './modules/rooms/rooms.service';
import { onUserOffline, resetPresence } from './realtime/presence';
import { initRealtime } from './realtime/socket';
import { logger } from './utils/logger';

async function main() {
  await connectDb(env.MONGO_URI);

  // Live state (presence, calls, rooms) can't survive a restart
  await resetPresence();
  await recoverCallsOnStartup();
  await endRoomsOnStartup();

  // When someone really goes offline: end their calls and take them out of rooms
  onUserOffline(endCallsOfOfflineUser);
  onUserOffline((userId) => leaveAllRooms(userId));

  const server = http.createServer(createApp());
  const io = initRealtime(server);

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') logger.error(`Port ${env.PORT} is already in use. Set a different PORT in .env.`);
    else logger.error('HTTP server error', error);
    process.exit(1);
  });
  server.listen(env.PORT, () => logger.info(`Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`));
  if (!env.agora) logger.warn('Agora is not configured: calls and rooms work, but without voice credentials');

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    shutdownCalls();
    io.close();
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    // Drop idle keep-alive connections so the port frees up immediately (fast dev reloads)
    server.closeIdleConnections();
    // Force exit if connections don't close in time
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => logger.error('Unhandled promise rejection', reason));

main().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
