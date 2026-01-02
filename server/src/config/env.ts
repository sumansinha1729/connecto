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

  // Listener earnings (in paise: 100 paise = ₹1)
  LISTENER_EARNING_PAISE_PER_MIN: z.coerce.number().int().nonnegative().default(200),
  PAYOUT_MIN_PAISE: z.coerce.number().int().positive().default(50_000),
  /** Shown to listeners, e.g. "Payouts are sent every week" */
  PAYOUT_SCHEDULE: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),

  // Voice intros
  VOICE_INTRO_MIN_SEC: z.coerce.number().int().positive().default(30),
  VOICE_INTRO_MAX_SEC: z.coerce.number().int().positive().default(60),

  // Calls & rooms
  CALL_RING_TIMEOUT_SEC: z.coerce.number().int().positive().default(30),
  /** Billing interval. Only lowered in tests; production is always 60 */
  CALL_BILLING_INTERVAL_SEC: z.coerce.number().int().positive().default(60),
  /** How long a user may be disconnected before they count as offline (calls end, rooms are left) */
  PRESENCE_GRACE_SEC: z.coerce.number().int().nonnegative().default(15),
  ROOM_MAX_PARTICIPANTS: z.coerce.number().int().positive().default(200),

  // File storage (voice intros). "local" saves to STORAGE_DIR; "s3" comes later.
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  STORAGE_DIR: z.string().default('uploads'),
  /** Public URL of this server, used to build links to stored files */
  PUBLIC_BASE_URL: z.string().url().optional(),

  // Agora voice (https://console.agora.io, project with "App ID + Token" auth).
  // Without these the server still runs calls/rooms, but returns no voice credentials.
  AGORA_APP_ID: z.string().optional(),
  AGORA_APP_CERTIFICATE: z.string().optional(),
  AGORA_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(3600),
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
  billingIntervalSec: isProduction ? 60 : parsed.data.CALL_BILLING_INTERVAL_SEC,
  publicBaseUrl: (parsed.data.PUBLIC_BASE_URL ?? `http://localhost:${parsed.data.PORT}`).replace(/\/+$/, ''),
  agora:
    parsed.data.AGORA_APP_ID && parsed.data.AGORA_APP_CERTIFICATE
      ? { appId: parsed.data.AGORA_APP_ID, certificate: parsed.data.AGORA_APP_CERTIFICATE }
      : null,
};
