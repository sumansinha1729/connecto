import type http from 'node:http';

import { Server } from 'socket.io';

import { env } from '../config/env';
import { verifyAccessToken } from '../modules/auth/tokens';
import { liveRoomIdsForUser } from '../modules/rooms/rooms.service';
import { User } from '../modules/users/user.model';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { roomChannel, setIo, userChannel, type IoServer } from './io';
import { socketConnected, socketDisconnected } from './presence';

/**
 * Attaches Socket.IO to the HTTP server. Clients connect with
 * `io(url, { auth: { token: accessToken } })`.
 */
export function initRealtime(httpServer: http.Server): IoServer {
  const io: IoServer = new Server(httpServer, {
    cors: { origin: env.isProduction ? env.corsOrigins : true },
    pingInterval: 20_000,
    pingTimeout: 20_000,
    // Clients only listen; they never send large messages
    maxHttpBufferSize: 16 * 1024,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') throw ApiError.unauthorized();
      const { userId } = verifyAccessToken(token);
      const user = await User.findById(userId).select('status').lean();
      if (!user || user.status !== 'active') throw ApiError.unauthorized();
      socket.data.userId = userId;
      next();
    } catch (error) {
      // The client sees this as connect_error with message "UNAUTHORIZED" and should refresh its token
      next(new Error(error instanceof ApiError ? error.code : 'UNAUTHORIZED'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId } = socket.data;
    socket.on('disconnect', () => socketDisconnected(userId, socket.id));
    try {
      await socket.join(userChannel(userId));
      // Rejoin the voice room after a reconnect
      for (const roomId of await liveRoomIdsForUser(userId)) await socket.join(roomChannel(roomId));
      await socketConnected(userId, socket.id);
    } catch (error) {
      logger.error('Socket setup failed', error);
    }
  });

  setIo(io);
  return io;
}
