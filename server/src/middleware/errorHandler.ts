import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';

import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.path} not found.`));
};

/** Converts any thrown error into the standard `{ error: { code, message } }` response. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let apiError: ApiError;

  if (err instanceof ApiError) {
    apiError = err;
  } else if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path.join('.');
    apiError = ApiError.badRequest(
      first ? `${field ? `${field}: ` : ''}${first.message}` : 'Invalid input.',
      'VALIDATION',
      err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  } else if (err instanceof mongoose.Error.CastError) {
    apiError = ApiError.notFound('Not found.');
  } else if (err instanceof SyntaxError && 'body' in err) {
    apiError = ApiError.badRequest('Request body is not valid JSON.');
  } else {
    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);
    apiError = new ApiError(
      500,
      'INTERNAL',
      env.isProduction ? 'Something went wrong. Please try again.' : String(err?.message ?? err),
    );
  }

  res.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details !== undefined && { details: apiError.details }),
    },
  });
};
