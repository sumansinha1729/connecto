import 'dotenv/config';
import { z } from 'zod';

/**
 * All configuration comes from environment variables, validated once at startup.
 * The server refuses to boot with a missing or malformed value.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4050),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  /** Comma-separated list of allowed browser origins (production only) */
  CORS_ORIGINS: z.string().default(''),

  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(15 * 60),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // OTP
  OTP_TTL_SEC: z.coerce.number().int().positive().default(5 * 60),
  OTP_RESEND_SEC: z.coerce.number().int().positive().default(30),
  OTP_MAX_PER_WINDOW: z.coerce.number().int().positive().default(3),
  OTP_WINDOW_SEC: z.coerce.number().int().positive().default(10 * 60),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  /**
   * Per-IP limit on OTP requests per OTP_WINDOW_SEC. Kept generous because Indian
   * mobile networks put many users behind one shared IP (carrier-grade NAT).
   */
  OTP_IP_MAX_PER_WINDOW: z.coerce.number().int().positive().default(50),
  /** Accepted for every number outside production, so testing doesn't need SMS */
  DEV_OTP: z.string().regex(/^\d{6}$/).optional(),

  // Coins
  SIGNUP_BONUS_COINS: z.coerce.number().int().nonnegative().default(50),
  CALL_RATE_COINS_PER_MIN: z.coerce.number().int().positive().default(10),
  LISTENER_SHARE_PERCENT: z.coerce.number().int().min(0).max(100).default(50),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

const isProduction = parsed.data.NODE_ENV === 'production';

export const env = {
  ...parsed.data,
  isProduction,
  isTest: parsed.data.NODE_ENV === 'test',
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  /** The dev OTP is never honoured in production, even if set by mistake */
  devOtp: isProduction ? undefined : parsed.data.DEV_OTP,
};
