import type { RequestHandler } from 'express';

import { ApiError } from '../utils/ApiError';
import { currentUser, requireAuth } from './auth';

/** Logged in *and* an admin. Admins are created with `npm run make-admin -- <phone>`. */
export const requireAdmin: RequestHandler[] = [
  requireAuth,
  (req, _res, next) => {
    if (!currentUser(req).isAdmin) throw ApiError.forbidden('Admins only.');
    next();
  },
];
