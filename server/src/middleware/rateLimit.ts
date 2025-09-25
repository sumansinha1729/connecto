import type { Request, RequestHandler } from 'express';

import { ApiError } from '../utils/ApiError';

interface Options {
  windowSec: number;
  max: number;
  /** Defaults to the client IP */
  key?: (req: Request) => string;
  message?: string;
}

/**
 * Fixed-window, in-memory rate limiter. Good enough for a single server;
 * move the counters to Redis when running more than one instance.
 */
export function rateLimit({ windowSec, max, key = (req) => req.ip ?? 'unknown', message }: Options): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  setInterval(() => {
    const now = Date.now();
    for (const [k, entry] of hits) if (entry.resetAt <= now) hits.delete(k);
  }, windowSec * 1000).unref();

  return (req, res, next) => {
    const now = Date.now();
    const k = key(req);
    let entry = hits.get(k);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowSec * 1000 };
      hits.set(k, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      throw ApiError.tooManyRequests(message);
    }
    next();
  };
}
