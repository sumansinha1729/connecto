import { Router } from 'express';

import { isDbConnected } from '../../config/db';

export const healthRouter = Router();

/** Liveness + database check, used by the hosting platform and for local debugging. */
healthRouter.get('/', (_req, res) => {
  const db = isDbConnected();
  res.status(db ? 200 : 503).json({
    status: db ? 'ok' : 'degraded',
    db: db ? 'up' : 'down',
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
