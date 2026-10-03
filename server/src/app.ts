import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { rateLimit } from './middleware/rateLimit';
import { healthRouter } from './modules/health/health.routes';
import { mediaRouter } from './modules/storage/media.routes';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Needed for correct client IPs (rate limiting) behind the hosting platform's proxy
  app.set('trust proxy', 1);

  // Allow the app (a different origin) to play audio served from /media
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // In development any origin is allowed so Expo web / emulators can connect
  app.use(cors({ origin: env.isProduction ? env.corsOrigins : true }));
  app.use(express.json({ limit: '100kb' }));
  if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  app.use('/health', healthRouter);
  app.use('/media', mediaRouter);
  app.use(
    '/api/v1',
    rateLimit({
      windowSec: 60,
      max: env.API_RATE_LIMIT_PER_MIN,
      // Per signed-in user (their token), so many users sharing one mobile-network IP don't block each other
      key: (req) => req.get('authorization') ?? req.ip ?? 'unknown',
      message: 'Too many requests. Please slow down.',
    }),
    apiRouter,
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
