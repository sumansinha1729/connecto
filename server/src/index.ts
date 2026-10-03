import { connectDb, disconnectDb } from './config/db';
import { configWarnings, env } from './config/env';
import { startServer } from './server';
import { logger } from './utils/logger';

async function main() {
  await connectDb(env.MONGO_URI);

  let running;
  try {
    running = await startServer(env.PORT);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      logger.error(`Port ${env.PORT} is already in use. Set a different PORT in .env.`);
      process.exit(1);
    }
    throw error;
  }
  logger.info(`Server listening on http://localhost:${running.port} (${env.NODE_ENV})`);
  for (const warning of configWarnings()) logger.warn(warning);

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    // Force exit if connections don't close in time
    setTimeout(() => process.exit(1), 10_000).unref();
    running
      .close()
      .then(disconnectDb)
      .then(() => process.exit(0))
      .catch((error) => {
        logger.error('Error during shutdown', error);
        process.exit(1);
      });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => logger.error('Unhandled promise rejection', reason));
// The process state is unknown after an uncaught exception: log it and let the host restart us
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception, exiting', error);
  process.exit(1);
});

main().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
