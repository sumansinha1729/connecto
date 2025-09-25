import http from 'node:http';

import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { env } from './config/env';
import { logger } from './utils/logger';

async function main() {
  await connectDb(env.MONGO_URI);

  // A plain HTTP server so Socket.IO can attach to the same port later
  const server = http.createServer(createApp());
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') logger.error(`Port ${env.PORT} is already in use. Set a different PORT in .env.`);
    else logger.error('HTTP server error', error);
    process.exit(1);
  });
  server.listen(env.PORT, () => logger.info(`Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`));

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
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
