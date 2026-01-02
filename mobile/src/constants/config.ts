/**
 * Business rules shown in the UI. The server enforces them (server/.env);
 * keep these display values in sync.
 */
export const CALL_RATE_PER_MIN = 10;
export const SIGNUP_BONUS = 50;
export const RING_TIMEOUT_SEC = 30;
export const OTP_LENGTH = 6;
export const OTP_RESEND_SEC = 30;
export const MIN_AGE = 18;

/** Listener earnings: ₹2.00 per minute, withdraw from ₹500, paid weekly */
export const LISTENER_EARNING_PAISE_PER_MIN = 200;
export const PAYOUT_MIN_PAISE = 50_000;

/** Listener voice intro length */
export const VOICE_INTRO_MIN_SEC = 30;
export const VOICE_INTRO_MAX_SEC = 60;
