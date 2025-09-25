import type { Request, RequestHandler } from 'express';

import { verifyAccessToken } from '../modules/auth/tokens';
import { User, type UserDoc } from '../modules/users/user.model';
import { ApiError } from '../utils/ApiError';

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserDoc;
  }
}

/** Requires `Authorization: Bearer <accessToken>` and loads the active user onto `req.user`. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized();

  const { userId } = verifyAccessToken(header.slice('Bearer '.length));
  const user = await User.findById(userId);
  if (!user || user.status === 'deleted') throw ApiError.unauthorized('Your session has expired. Please log in again.');
  if (user.status === 'banned') throw ApiError.forbidden('Your account has been suspended. Contact support for help.');

  req.user = user;
  next();
};

/** The authenticated user. Only use in handlers behind `requireAuth`. */
export function currentUser(req: Request): UserDoc {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}
