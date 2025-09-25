import type { RequestHandler } from 'express';
import type { z } from 'zod';

interface Schemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

/**
 * Validates request input with zod. Parsed values replace the raw ones on
 * `req.body` and `req.params`; parsed query is stored on `res.locals.query`
 * because `req.query` is read-only in Express 5.
 * Invalid input throws a ZodError, which the error handler turns into a 400.
 */
export function validate({ body, query, params }: Schemas): RequestHandler {
  return (req, res, next) => {
    if (body) req.body = body.parse(req.body);
    if (params) req.params = params.parse(req.params) as typeof req.params;
    if (query) res.locals.query = query.parse(req.query);
    next();
  };
}
