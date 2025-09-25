import crypto from 'node:crypto';

import { env } from '../config/env';

/** Keyed hash for low-entropy secrets like OTP codes (can't be brute-forced without the key). */
export function hmac(value: string): string {
  return crypto.createHmac('sha256', env.JWT_SECRET).update(value).digest('hex');
}

/** Plain hash for high-entropy random tokens such as refresh tokens. */
export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function randomDigits(length: number): string {
  return crypto.randomInt(0, 10 ** length).toString().padStart(length, '0');
}

/** Constant-time comparison of two hex digests */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}
