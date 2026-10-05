import { getApps, initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, signOut, type Auth, type ConfirmationResult } from 'firebase/auth';

/**
 * Firebase Phone Auth: Google sends the SMS and checks the code; the server then turns the
 * Firebase ID token into an admin session. Without these settings the panel uses the
 * server's dev codes (local testing only).
 * Firebase console → Project settings → Your apps → Web app.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseLoginEnabled = Object.values(config).every(Boolean) && import.meta.env.VITE_LOGIN !== 'dev';

let auth: Auth | null = null;
let verifier: RecaptchaVerifier | null = null;
let confirmation: ConfirmationResult | null = null;

const firebaseAuth = () => {
  auth ??= getAuth(getApps()[0] ?? initializeApp(config));
  auth.languageCode = 'en';
  return auth;
};

/** Sends the SMS. `container` holds Google's "not a robot" check (invisible unless needed). */
export async function sendFirebaseCode(phone: string, container: HTMLElement) {
  const a = firebaseAuth();
  if (a.currentUser) await signOut(a).catch(() => {});
  verifier?.clear();
  verifier = new RecaptchaVerifier(a, container, { size: 'invisible' });
  confirmation = await signInWithPhoneNumber(a, `+91${phone}`, verifier);
}

/** Checks the code with Google and returns the ID token for the server */
export async function confirmFirebaseCode(code: string): Promise<string> {
  if (!confirmation) throw Object.assign(new Error('No code requested'), { code: 'auth/missing-verification-id' });
  const { user } = await confirmation.confirm(code);
  const idToken = await user.getIdToken();
  // The server issues its own session; Firebase's sign-in isn't needed any more
  await signOut(firebaseAuth()).catch(() => {});
  return idToken;
}

/** Firebase error codes → readable messages; anything else is passed to `fallback` */
export function firebaseErrorMessage(error: unknown, fallback: (error: unknown) => string): string {
  const code = String((error as { code?: unknown } | null)?.code ?? '');
  if (!code.startsWith('auth/')) return fallback(error);
  if (code === 'auth/invalid-verification-code') return 'That code is incorrect. Please try again.';
  if (code === 'auth/code-expired' || code === 'auth/session-expired') return 'This code has expired. Please request a new one.';
  if (code === 'auth/too-many-requests' || code === 'auth/quota-exceeded') return 'Too many attempts. Please try again later.';
  if (code === 'auth/network-request-failed') return 'No internet connection. Check your network and try again.';
  if (code === 'auth/unauthorized-domain') return 'This website isn’t allowed to use phone login yet (Firebase → Authentication → Settings → Authorized domains).';
  if (code === 'auth/operation-not-allowed') return 'Phone login isn’t turned on in Firebase yet.';
  if (code.startsWith('auth/api-key') || code === 'auth/invalid-api-key') return 'The Firebase settings (VITE_FIREBASE_*) are wrong. Check them and rebuild.';
  return 'Couldn’t send or check the code. Please try again.';
}
