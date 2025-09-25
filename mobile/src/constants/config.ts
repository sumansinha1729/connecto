/** App-wide business rules. The server will own these once the backend is wired in. */
export const CALL_RATE_PER_MIN = 10;
export const LISTENER_SHARE = 0.5;
export const SIGNUP_BONUS = 50;
export const RING_TIMEOUT_SEC = 30;
export const OTP_LENGTH = 6;
export const OTP_RESEND_SEC = 30;
/** In mock mode this code is accepted for every phone number */
export const DEV_OTP = '123456';
export const MIN_AGE = 18;
