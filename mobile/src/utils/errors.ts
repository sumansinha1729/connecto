export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_PHONE'
  | 'INVALID_OTP'
  | 'NOT_FOUND'
  | 'INSUFFICIENT_BALANCE'
  | 'USER_UNAVAILABLE'
  | 'BLOCKED'
  | 'NO_MATCH'
  | 'VALIDATION'
  | 'UNKNOWN';

export class ApiError extends Error {
  code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
