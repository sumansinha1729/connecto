/**
 * Firebase Phone Auth: Google sends the SMS and checks the code; we get back a Firebase
 * ID token, which our server turns into a Connecto session (POST /auth/firebase).
 * Without Firebase set up, the app falls back to our server's dev codes.
 */
import { getErrorMessage } from '@/utils/errors';

export interface PhoneAuth {
  /** Firebase is set up in this build (Android) or site (web) */
  readonly available: boolean;
  /** Sends the SMS to a 10-digit Indian number */
  sendCode(phone: string): Promise<void>;
  /** Checks the code with Google and returns the ID token for our server */
  confirmCode(code: string): Promise<string>;
  /** Android can read the SMS and verify the number by itself. Returns an unsubscribe function. */
  onAutoVerified(callback: (idToken: string) => void): () => void;
  /** Forgets the Firebase sign-in: our server issues its own session */
  reset(): Promise<void>;
}

/** Turns Firebase error codes into messages people understand (other errors keep their own message) */
export function phoneAuthErrorMessage(error: unknown): string {
  const code = String((error as { code?: unknown } | null)?.code ?? '');
  if (!code.startsWith('auth/')) return getErrorMessage(error);
  // A wrong key in the app's Firebase settings
  if (code.startsWith('auth/api-key') || code === 'auth/invalid-api-key') return 'Phone login isn’t set up yet. Please try again later.';
  switch (code) {
    case 'auth/invalid-verification-code':
      return 'That code is incorrect. Please try again.';
    case 'auth/code-expired':
    case 'auth/session-expired':
      return 'This code has expired. Please request a new one.';
    case 'auth/invalid-phone-number':
      return 'Enter a valid 10-digit mobile number.';
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'No internet connection. Check your network and try again.';
    case 'auth/missing-verification-id':
    case 'auth/missing-verification-code':
      return 'Please request a new code.';
    case 'auth/captcha-check-failed':
    case 'auth/missing-client-identifier':
    case 'auth/app-not-authorized':
    case 'auth/invalid-app-credential':
      return 'We couldn’t verify this device. Please try again.';
    case 'auth/operation-not-allowed':
    case 'auth/unauthorized-domain':
      return 'Phone login isn’t set up yet. Please try again later.';
    default:
      return 'Couldn’t send or check the code. Please try again.';
  }
}

/** Login screens use Firebase when it's set up, unless EXPO_PUBLIC_LOGIN=dev asks for our dev codes */
export const forceDevLogin = process.env.EXPO_PUBLIC_LOGIN === 'dev';
