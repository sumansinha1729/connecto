/**
 * Error codes shared with the mobile app (see mobile/src/utils/errors.ts).
 * Every error response has the shape: { error: { code, message, details? } }
 */
export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INVALID_PHONE'
  | 'INVALID_OTP'
  | 'INSUFFICIENT_BALANCE'
  | 'USER_UNAVAILABLE'
  | 'BLOCKED'
  | 'NO_MATCH'
  | 'INTERNAL';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, code: ErrorCode = 'VALIDATION', details?: unknown) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = 'Please log in to continue.') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'You are not allowed to do that.') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Not found.') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string, code: ErrorCode = 'CONFLICT') {
    return new ApiError(409, code, message);
  }

  static tooManyRequests(message = 'Too many requests. Please try again later.') {
    return new ApiError(429, 'RATE_LIMITED', message);
  }
}
