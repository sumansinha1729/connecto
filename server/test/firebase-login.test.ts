// Firebase Phone Auth: the server only accepts a genuine, fresh ID token for an Indian number
import { call, check, login, makeAdmin, makeUser, startTestServer, stopTestServer } from './helpers';

import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';

import { setFirebaseCertsForTests } from '../src/modules/auth/firebase';
import { User } from '../src/modules/users/user.model';

const PROJECT = 'connecto-test';
const pair = () => crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const google = pair(); // stands in for Google's signing key
const attacker = pair();

before(async () => {
  setFirebaseCertsForTests({ 'key-1': google.publicKey.export({ type: 'spki', format: 'pem' }).toString() });
  await startTestServer('firebase');
});
after(async () => {
  setFirebaseCertsForTests(null);
  await stopTestServer();
});

/** An ID token like the one the Firebase SDK gives the app after the code is entered */
function idToken(phone: string, overrides: { claims?: Record<string, unknown>; key?: crypto.KeyObject; kid?: string; authAgeSec?: number } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: `firebase-uid-${phone}`,
    iat: now,
    exp: now + 3600,
    auth_time: now - (overrides.authAgeSec ?? 5),
    phone_number: phone,
    firebase: { identities: { phone: [phone] }, sign_in_provider: 'phone' },
    ...overrides.claims,
  };
  return jwt.sign(claims, overrides.key ?? google.privateKey, { algorithm: 'RS256', keyid: overrides.kid ?? 'key-1' });
}

const firebaseLogin = (token: string, admin = false) => call('POST', admin ? '/auth/admin/firebase' : '/auth/firebase', { body: { idToken: token } });

test('firebase login: creates the account once, same account as before', async () => {
  let r = await firebaseLogin(idToken('+919811100001'));
  check('new number logs in', r.status === 200 && r.data.accessToken && r.data.isNewUser === true, r);
  check('stored as +91 number', r.data.user.phone === '+919811100001', r.data.user);
  const id = r.data.user.id;

  const wallet = await call('GET', '/wallet', { token: r.data.accessToken });
  check('welcome bonus credited', wallet.data.balance === 50, wallet.data);

  r = await firebaseLogin(idToken('+919811100001'));
  check('second login: same account, no new signup', r.status === 200 && r.data.user.id === id && r.data.isNewUser === false, r);

  // Someone who signed up with the dev code keeps their account when the app switches to Firebase
  const old = await login('9811100002');
  r = await firebaseLogin(idToken('+919811100002'));
  check('existing account is found by number', r.status === 200 && r.data.user.id === old.id && r.data.isNewUser === false, r);
});

test('firebase login: forged, stale or foreign tokens are refused', async () => {
  const refused = async (name: string, token: string, status = 401) => {
    const r = await firebaseLogin(token);
    check(name, r.status === status, r);
  };
  const phone = '+919811100003';

  await refused('signed with another key', idToken(phone, { key: attacker.privateKey }));
  await refused('unknown key id', idToken(phone, { kid: 'key-2' }));
  await refused('another Firebase project', idToken(phone, { claims: { aud: 'someone-else' } }));
  await refused('code entered too long ago', idToken(phone, { authAgeSec: 20 * 60 }));
  await refused('not a phone sign-in', idToken(phone, { claims: { firebase: { sign_in_provider: 'password' } } }));
  await refused('garbage', 'x'.repeat(200));
  await refused('expired token', idToken(phone, { claims: { iat: 1, exp: 100 }, authAgeSec: 0 }));
  await refused('non-Indian number', idToken('+447444555666'), 400);
  await refused('Indian landline-style number', idToken('+911123456789'), 400);
  check('no account was created by any of these', !(await User.exists({ phone })));
});

test('firebase login: banned users and the admin panel', async () => {
  const banned = await makeUser('9811100004', 'Bina');
  await User.updateOne({ _id: banned.id }, { status: 'banned' });
  let r = await firebaseLogin(idToken('+919811100004'));
  check('banned user is refused', r.status === 403 && /suspended/.test(r.data.error.message), r);

  r = await firebaseLogin(idToken('+919811100099'), true);
  check('admin panel: unknown number refused', r.status === 403 && /admin access/.test(r.data.error.message), r);
  check('…and no account was created', !(await User.exists({ phone: '+919811100099' })));

  const user = await makeUser('9811100005', 'Uma');
  r = await firebaseLogin(idToken('+919811100005'), true);
  check('admin panel: app users refused', r.status === 403, r);

  await makeAdmin(user);
  r = await firebaseLogin(idToken('+919811100005'), true);
  check('admin panel: admin logs in', r.status === 200 && r.data.user.isAdmin === true, r);
});
