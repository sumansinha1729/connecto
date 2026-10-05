import { getApps, initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, signOut, type Auth, type ConfirmationResult } from 'firebase/auth';

import type { PhoneAuth } from './types';

/** Firebase console → Project settings → Your apps → Web app (all four are needed) */
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
const configured = Object.values(config).every(Boolean);

let auth: Auth | null = null;
const getFirebaseAuth = () => {
  auth ??= getAuth(getApps()[0] ?? initializeApp(config));
  auth.languageCode = 'en';
  return auth;
};

/** In the browser Google asks for an "I'm not a robot" check; it's invisible unless something looks odd */
let verifier: RecaptchaVerifier | null = null;
function recaptcha(firebaseAuth: Auth) {
  verifier?.clear();
  document.getElementById('recaptcha-container')?.remove();
  const container = document.createElement('div');
  container.id = 'recaptcha-container';
  document.body.appendChild(container);
  verifier = new RecaptchaVerifier(firebaseAuth, container, { size: 'invisible' });
  return verifier;
}

let confirmation: ConfirmationResult | null = null;

export const phoneAuth: PhoneAuth = {
  available: configured,

  async sendCode(phone) {
    const firebaseAuth = getFirebaseAuth();
    if (firebaseAuth.currentUser) await signOut(firebaseAuth).catch(() => {});
    confirmation = await signInWithPhoneNumber(firebaseAuth, `+91${phone}`, recaptcha(firebaseAuth));
  },

  async confirmCode(code) {
    if (!confirmation) throw Object.assign(new Error('No code requested'), { code: 'auth/missing-verification-id' });
    const { user } = await confirmation.confirm(code);
    return user.getIdToken();
  },

  // The browser can't read SMS
  onAutoVerified: () => () => {},

  async reset() {
    confirmation = null;
    verifier?.clear();
    verifier = null;
    document.getElementById('recaptcha-container')?.remove();
    if (auth?.currentUser) await signOut(auth).catch(() => {});
  },
};
