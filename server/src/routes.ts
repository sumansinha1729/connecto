import { Router } from 'express';

import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { walletRouter } from './modules/wallet/wallet.routes';

/**
 * All versioned API routes, mounted at /api/v1.
 * Each feature module adds its router here.
 */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/wallet', walletRouter);
