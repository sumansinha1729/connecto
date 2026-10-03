import dotenv from 'dotenv';
import { z } from 'zod';

// Automated tests set their own configuration and never read the developer's .env
if (process.env.NODE_ENV !== 'test') dotenv.config({ quiet: true });

/**
 * All configuration comes from environment variables, validated once at startup.
 * The server refuses to boot with a missing or malformed value.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().nonnegative().default(4050),
  /** Defaults to "info" in production and "debug" otherwise */
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  /** Requests per minute per signed-in user (or per IP when signed out), across the whole API */
  API_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(300),
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
  /** Voice tokens are short-lived and renewed by the app while the call/room is still on, so nobody keeps talking after it ends */
  AGORA_TOKEN_TTL_SEC: z.coerce.number().int().min(60).default(600),
});

/** Mistakes that are fine on a laptop but must never reach real users */
const productionSchema = schema.superRefine((config, ctx) => {
  if (config.NODE_ENV !== 'production') return;
  if (!config.PUBLIC_BASE_URL?.startsWith('https://')) {
    ctx.addIssue({ code: 'custom', path: ['PUBLIC_BASE_URL'], message: 'must be the public https:// address of this server in production' });
  }
  if (/^(.)\1+$/.test(config.JWT_SECRET) || /change|secret|example/i.test(config.JWT_SECRET) || config.JWT_SECRET.length < 64) {
    ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'use a fresh random value in production: `openssl rand -hex 48`' });
  }
  if (/127\.0\.0\.1|localhost/.test(config.MONGO_URI)) {
    ctx.addIssue({ code: 'custom', path: ['MONGO_URI'], message: 'points at a local database in production' });
  }
});

// An empty line like `DEV_OTP=` in .env means "not set"
const provided = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ''));
const parsed = productionSchema.safeParse(provided);

if (!parsed.success) {
  console.error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

const isProduction = parsed.data.NODE_ENV === 'production';

/** Things that still work but need attention before real users arrive. Logged at startup. */
export function configWarnings(): string[] {
  const warnings: string[] = [];
  if (!env.agora) warnings.push('Agora is not configured: calls and rooms work, but without voice credentials');
  if (isProduction && env.STORAGE_DRIVER === 'local') {
    warnings.push('STORAGE_DRIVER=local in production: voice intros are lost when the server is redeployed');
  }
  if (isProduction && env.corsOrigins.length === 0) {
    warnings.push('CORS_ORIGINS is empty: fine for the mobile app, but browsers (e.g. a web admin) are refused');
  }
  return warnings;
}

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
