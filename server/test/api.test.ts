// Auth (OTP, tokens), profiles, discover, favourites, blocks, reports, wallet, account deletion
import {
  call,
  check,
  lastOtp,
  login,
  makeAdmin,
  makeListener,
  makeUser,
  serverUrl,
  sleep,
  startTestServer,
  stopTestServer,
  uploadVoiceIntro,
  type TestUser,
} from './helpers';

import { after, before, test } from 'node:test';

import { Session } from '../src/modules/auth/session.model';
import { Report } from '../src/modules/users/relations.model';

before(() => startTestServer('api'));
after(stopTestServer);

const profile = { name: 'Asha', gender: 'female', age: 24, languages: ['Hindi', 'English'], interests: ['Career'], bio: 'hi' };

test('health check and unknown routes', async () => {
  const health = await fetch(`${serverUrl()}/health`);
  const body = await health.json();
  check('health is ok with the database up', health.status === 200 && body.db === 'up', body);
  const r = await call('GET', '/nope');
  check('unknown route → 404 JSON', r.status === 404 && r.data.error.code === 'NOT_FOUND', r);
});

test('auth: OTP, tokens, refresh rotation, logout', async () => {
  let r = await call('POST', '/auth/otp/request', { body: { phone: '12345' } });
  check('short phone rejected by schema', r.status === 400 && r.data.error.code === 'VALIDATION', r);
  r = await call('POST', '/auth/otp/request', { body: { phone: '5123456789' } });
  check('non-mobile number → INVALID_PHONE', r.status === 400 && r.data.error.code === 'INVALID_PHONE', r);

  r = await call('POST', '/auth/otp/request', { body: { phone: '+91 98765 43210' } });
  check('request OTP ok', r.status === 200 && r.data.devOtp === '123456' && r.data.expiresInSec === 300, r);
  r = await call('POST', '/auth/otp/request', { body: { phone: '9876543210' } });
  check('immediate resend → 429', r.status === 429 && r.data.error.code === 'RATE_LIMITED', r);

  await sleep(1100);
  r = await call('POST', '/auth/otp/request', { body: { phone: '9876543210' } });
  check('resend after wait ok', r.status === 200, r);
  const realCode = lastOtp('+919876543210');
  check('code sent by SMS', /^\d{6}$/.test(realCode ?? ''), realCode);

  r = await call('POST', '/auth/otp/verify', { body: { phone: '9876543210', code: realCode === '000000' ? '111111' : '000000' } });
  check('wrong code → INVALID_OTP', r.status === 400 && r.data.error.code === 'INVALID_OTP', r);
  r = await call('POST', '/auth/otp/verify', { body: { phone: '9876543210', code: '12ab56' } });
  check('non-digit code → VALIDATION', r.status === 400 && r.data.error.code === 'VALIDATION', r);

  r = await call('POST', '/auth/otp/verify', { body: { phone: '9876543210', code: realCode } });
  check('real code logs in', r.status === 200 && r.data.isNewUser === true && r.data.accessToken && r.data.refreshToken, r);
  check('phone stored as E.164', r.data.user?.phone === '+919876543210', r.data.user);
  check('new profile incomplete', r.data.user?.profileComplete === false, r.data.user);
  const first = r.data;

  r = await call('POST', '/auth/otp/verify', { body: { phone: '9876543210', code: realCode } });
  check('same code cannot be reused', r.status === 400 && r.data.error.code === 'INVALID_OTP', r);

  await sleep(1100);
  r = await call('POST', '/auth/otp/request', { body: { phone: '9876543210' } });
  check('3rd OTP in window ok', r.status === 200, r);
  await sleep(1100);
  r = await call('POST', '/auth/otp/request', { body: { phone: '9876543210' } });
  check('4th OTP in window → 429', r.status === 429, r);

  r = await call('POST', '/auth/otp/verify', { body: { phone: '9876543210', code: '123456' } });
  check('second login is existing user', r.status === 200 && r.data.isNewUser === false && r.data.user.id === first.user.id, r);

  // Attempt lockout on a fresh number
  await call('POST', '/auth/otp/request', { body: { phone: '9000000001' } });
  const code = lastOtp('+919000000001')!;
  const wrong = code === '999999' ? '999998' : '999999';
  for (let i = 0; i < 4; i++) await call('POST', '/auth/otp/verify', { body: { phone: '9000000001', code: wrong } });
  r = await call('POST', '/auth/otp/verify', { body: { phone: '9000000001', code: wrong } });
  check('5th wrong attempt locks the code', r.status === 400 && /Too many wrong attempts/.test(r.data.error.message), r);
  r = await call('POST', '/auth/otp/verify', { body: { phone: '9000000001', code } });
  check('correct code after lockout rejected', r.status === 400 && r.data.error.code === 'INVALID_OTP', r);

  // Tokens
  r = await call('GET', '/users/me');
  check('no token → 401', r.status === 401 && r.data.error.code === 'UNAUTHORIZED', r);
  r = await call('GET', '/users/me', { token: 'garbage' });
  check('bad token → 401', r.status === 401, r);
  r = await call('GET', '/users/me', { token: first.accessToken });
  check('access token works', r.status === 200 && r.data.user.id === first.user.id, r);

  r = await call('POST', '/auth/refresh', { body: { refreshToken: first.refreshToken } });
  check('refresh rotates tokens', r.status === 200 && r.data.refreshToken !== first.refreshToken, r);
  const rotated = r.data;
  r = await call('POST', '/auth/refresh', { body: { refreshToken: first.refreshToken } });
  check('old refresh token rejected', r.status === 401, r);
  r = await call('POST', '/auth/refresh', { body: { refreshToken: rotated.refreshToken } });
  check('new refresh token still works (no false reuse alarm)', r.status === 200, r);
  const current = r.data;

  // Reuse after the grace period revokes everything
  await Session.updateMany({ revokedAt: { $ne: null } }, { $set: { revokedAt: new Date(Date.now() - 60_000) } });
  r = await call('POST', '/auth/refresh', { body: { refreshToken: rotated.refreshToken } });
  check('reused stolen token → 401', r.status === 401, r);
  r = await call('POST', '/auth/refresh', { body: { refreshToken: current.refreshToken } });
  check('…and all sessions of that user are revoked', r.status === 401, r);

  const s = await login('9555555555');
  r = await call('POST', '/auth/logout', { body: { refreshToken: s.refresh } });
  check('logout 204', r.status === 204, r);
  r = await call('POST', '/auth/refresh', { body: { refreshToken: s.refresh } });
  check('refresh after logout → 401', r.status === 401, r);
});

let A: TestUser;
let B: TestUser;
let C: TestUser;

test('users: profiles, discover, favourites, blocks, reports', async () => {
  A = await login('9111111111');
  await login('9444444444'); // never completes their profile
  const admin = await makeUser('9555500000', 'Admin');
  await makeAdmin(admin);

  let r = await call('PATCH', '/users/me', { token: A.token, body: { age: 16 } });
  check('under-18 rejected', r.status === 400 && /18/.test(r.data.error.message), r);
  r = await call('PATCH', '/users/me', { token: A.token, body: { phone: '+910000000000' } });
  check('unknown field rejected (strict)', r.status === 400, r);
  r = await call('PATCH', '/users/me', { token: A.token, body: { languages: ['Klingon'] } });
  check('invalid language rejected', r.status === 400, r);
  r = await call('PATCH', '/users/me', { token: A.token, body: { languages: ['Hindi', 'Hindi'] } });
  check('duplicate language rejected', r.status === 400, r);
  r = await call('PATCH', '/users/me', { token: A.token, body: { avatar: '<script>' } });
  check('bad avatar rejected', r.status === 400, r);

  r = await call('PATCH', '/users/me', { token: A.token, body: profile });
  check('profile completes', r.status === 200 && r.data.user.profileComplete === true && r.data.user.name === 'Asha', r);
  r = await call('PATCH', '/users/me', { token: A.token, body: { isAvailable: true } });
  check('regular user cannot be "available"', r.status === 403, r);

  // B and C become listeners through the real application path
  B = await makeListener('9222222222', 'Bharat', admin, { gender: 'male', languages: ['Tamil'] });
  check('approved listener is available', B.user.role === 'listener' && B.user.isAvailable === true, B.user);
  C = await makeListener('9333333333', 'Chitra', admin, { languages: ['Hindi', 'English'] });

  r = await call('GET', '/users', { token: A.token });
  const names = r.data.users.map((u: any) => u.name);
  check('list shows listeners only (no me, no admin, no incomplete)', !names.includes('Asha') && !names.includes('Admin') && names.length === 2, names);
  check('public users never expose phone', r.data.users.every((u: any) => !('phone' in u)), r.data.users[0]);

  r = await call('GET', '/users?language=Tamil', { token: A.token });
  check('language filter', r.data.users.length === 1 && r.data.users[0].name === 'Bharat', r.data);
  r = await call('GET', '/users?gender=female', { token: A.token });
  check('gender filter', r.data.users.length === 1 && r.data.users[0].name === 'Chitra', r.data);
  r = await call('GET', '/users?language=Martian', { token: A.token });
  check('bad filter value rejected', r.status === 400, r);

  r = await call('GET', `/users/${B.id}`, { token: A.token });
  check('get user profile', r.status === 200 && r.data.user.isFavorite === false, r);
  r = await call('GET', '/users/not-an-id', { token: A.token });
  check('bad id → 400', r.status === 400, r);
  r = await call('GET', '/users/0123456789abcdef01234567', { token: A.token });
  check('unknown id → 404', r.status === 404, r);

  r = await call('PUT', `/users/${B.id}/favorite`, { token: A.token });
  check('favourite 204', r.status === 204, r);
  await call('PUT', `/users/${B.id}/favorite`, { token: A.token });
  r = await call('GET', '/users/me/favorites', { token: A.token });
  check('favourite listed once (idempotent)', r.data.users.length === 1 && r.data.users[0].id === B.id, r.data);
  r = await call('GET', `/users/${B.id}`, { token: A.token });
  check('isFavorite true', r.data.user.isFavorite === true, r.data);
  r = await call('PUT', `/users/${A.id}/favorite`, { token: A.token });
  check('cannot favourite self', r.status === 400, r);

  // Blocking
  r = await call('PUT', `/users/${C.id}/block`, { token: A.token });
  check('block 204', r.status === 204, r);
  r = await call('GET', '/users', { token: A.token });
  check('blocked user hidden from blocker', !r.data.users.some((u: any) => u.id === C.id), r.data);
  r = await call('GET', '/users', { token: C.token });
  check('listeners don’t browse the user list', r.status === 403, r);
  r = await call('GET', `/users/${A.id}`, { token: C.token });
  check('blocked user cannot open blocker profile', r.status === 404, r);
  r = await call('PUT', `/users/${A.id}/favorite`, { token: C.token });
  check('blocked user cannot favourite blocker', r.status === 404, r);
  r = await call('GET', '/users/me/blocked', { token: A.token });
  check('blocked list', r.data.users.length === 1 && r.data.users[0].id === C.id, r.data);
  await call('DELETE', `/users/${C.id}/block`, { token: A.token });
  r = await call('GET', '/users', { token: A.token });
  check('unblock makes them visible again', r.data.users.some((u: any) => u.id === C.id), r.data);

  await call('PUT', `/users/${B.id}/block`, { token: A.token });
  r = await call('GET', '/users/me/favorites', { token: A.token });
  check('blocking removes favourite', r.data.users.length === 0, r.data);
  await call('DELETE', `/users/${B.id}/block`, { token: A.token });

  // Reports
  r = await call('POST', `/users/${B.id}/report`, { token: A.token, body: { reason: 'spam', details: ' too many ads ' } });
  check('report 204', r.status === 204, r);
  await call('POST', `/users/${B.id}/report`, { token: A.token, body: { reason: 'spam' } });
  check('duplicate report within a day ignored', (await Report.countDocuments()) === 1);
  r = await call('POST', `/users/${B.id}/report`, { token: A.token, body: { reason: 'nonsense' } });
  check('bad report reason rejected', r.status === 400, r);
  r = await call('POST', `/users/${A.id}/report`, { token: A.token, body: { reason: 'spam' } });
  check('cannot report self', r.status === 400, r);
});

test('wallet: signup bonus, packs, dev recharge, pagination', async () => {
  let r = await call('GET', '/wallet', { token: A.token });
  check('signup bonus credited', r.data.balance === 50 && r.data.transactions[0].type === 'signup_bonus', r.data);
  check('pricing returned', r.data.pricing.callRatePerMin === 10, r.data.pricing);
  r = await call('GET', '/wallet/packs', { token: A.token });
  check('packs listed', r.data.packs.length === 4, r.data);
  r = await call('POST', '/wallet/recharge', { token: A.token, body: { packId: 'pack_250' } });
  check('dev recharge credits coins + bonus', r.status === 200 && r.data.balance === 325, r.data);
  check('recharge recorded first', r.data.transactions[0].type === 'recharge' && r.data.transactions[0].amount === 275, r.data.transactions);
  r = await call('POST', '/wallet/recharge', { token: A.token, body: { packId: 'nope' } });
  check('unknown pack → 404', r.status === 404, r);
  r = await call('GET', '/wallet/transactions?limit=1', { token: A.token });
  check('paginated transactions', r.data.transactions.length === 1, r.data);
  r = await call('GET', `/wallet/transactions?before=${encodeURIComponent(r.data.transactions[0].createdAt)}`, { token: A.token });
  check('before cursor returns older', r.data.transactions.length === 1 && r.data.transactions[0].type === 'signup_bonus', r.data);
});

test('delete account', async () => {
  let r = await call('DELETE', '/users/me', { token: C.token });
  check('delete 204', r.status === 204, r);
  r = await call('GET', '/users/me', { token: C.token });
  check('deleted user token rejected', r.status === 401, r);
  r = await call('GET', '/users', { token: A.token });
  check('deleted user hidden', !r.data.users.some((u: any) => u.id === C.id), r.data);
  await sleep(1100);
  const again = await login('9333333333');
  check('same phone can sign up fresh', again.isNewUser === true && again.id !== C.id, again);
});

test('voice intro must be audio', async () => {
  const r = await uploadVoiceIntro(A.token, 40, 'image/png');
  check('non-audio upload rejected', r.status >= 400, r);
});

test('per-IP OTP limit', async () => {
  let limited = false;
  for (let i = 0; i < 60 && !limited; i++) {
    const r = await call('POST', '/auth/otp/request', { body: { phone: `98${10_000_000 + i}` }, ip: '203.0.113.7' });
    limited = r.status === 429 && /Too many attempts/.test(r.data.error.message);
  }
  check('per-IP OTP limit kicks in', limited);
});
