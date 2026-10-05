import type * as AuthModule from '@react-native-firebase/auth';

import type { PhoneAuth } from './types';

/**
 * React Native Firebase is native code. It's only in builds made with google-services.json
 * (see app.config.js), so load it lazily: without it, `available` is false and the app uses
 * the dev codes, just like before.
 */
let firebase: typeof AuthModule | null = null;
try {
  const { getApps } = require('@react-native-firebase/app') as typeof import('@react-native-firebase/app');
  if (getApps().length > 0) firebase = require('@react-native-firebase/auth');
} catch {
  firebase = null;
}

let confirmation: AuthModule.ConfirmationResult | null = null;
/** The number the code was sent to, as +91XXXXXXXXXX */
let pendingNumber: string | null = null;

export const phoneAuth: PhoneAuth = {
  available: firebase !== null,

  async sendCode(phone) {
    if (!firebase) throw new Error('Phone login isn’t available in this build.');
    // A sign-in left over from an earlier attempt must not log in this one
    if (firebase.getAuth().currentUser) await firebase.signOut(firebase.getAuth()).catch(() => {});
    pendingNumber = `+91${phone}`;
    confirmation = await firebase.signInWithPhoneNumber(firebase.getAuth(), pendingNumber);
  },

  async confirmCode(code) {
    if (!firebase || !confirmation) throw Object.assign(new Error('No code requested'), { code: 'auth/missing-verification-id' });
    const credential = await confirmation.confirm(code);
    // Android may have already verified the number by itself; then confirm() returns nothing new
    const user = credential?.user ?? firebase.getAuth().currentUser;
    if (!user) throw Object.assign(new Error('Not signed in'), { code: 'auth/invalid-verification-code' });
    return user.getIdToken();
  },

  onAutoVerified(callback) {
    if (!firebase) return () => {};
    const fb = firebase;
    return fb.onAuthStateChanged(fb.getAuth(), (user) => {
      if (user && pendingNumber && user.phoneNumber === pendingNumber) user.getIdToken().then(callback, () => {});
    });
  },

  async reset() {
    confirmation = null;
    pendingNumber = null;
    if (firebase?.getAuth().currentUser) await firebase.signOut(firebase.getAuth()).catch(() => {});
  },
};
