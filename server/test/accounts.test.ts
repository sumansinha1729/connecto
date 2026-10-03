
// Users vs listeners: applications with voice intro, call rules, ₹ earnings, payouts, revoke
import {
  basics,
  call,
  check,
  connect,
  fakeAudio,
  login,
  makeAdmin,
  makeListener,
  makeUser,
  onTestServer,
  sleep,
  startTestServer,
  stopTestServer,
  uploadVoiceIntro,
  waitFor,
  type TestUser,
} from './helpers';

import { after, before, test } from 'node:test';

import { EarningsAccount } from '../src/modules/earnings/earnings.model';

before(() => startTestServer('accounts'));
after(stopTestServer);

let admin: TestUser;
let L: TestUser; // listener who signed up as one
let L2: TestUser; // second listener
let U: TestUser; // user
let U2: TestUser; // user

const application = { fullName: 'Lata Sharma', dateOfBirth: '1995-04-10', city: 'Pune', about: 'I enjoy listening and helping friends.' };

test('listener signup path and voice intro', async () => {
  admin = await makeUser('9850000009', 'Admin');
  await makeAdmin(admin);

  L = await login('9850000001');
  let r = await call('POST', '/users/me/intent', { token: L.token, body: { intent: 'listener' } });
  check('choose listener at signup', r.status === 200 && r.data.user.signupIntent === 'listener', r.data);
  await call('PATCH', '/users/me', { token: L.token, body: { name: 'Lata', gender: 'female', languages: ['Hindi', 'English'] } });

  r = await call('GET', '/users', { token: L.token });
  check('applicant can’t browse listeners', r.status === 403 && /being reviewed/.test(r.data.error.message), r);

  r = await call('POST', '/users/me/listener-application', { token: L.token, body: application });
  check('application needs a voice intro first', r.status === 400 && /voice intro/.test(r.data.error.message), r);

  r = await uploadVoiceIntro(L.token, 40, 'image/png');
  check('non-audio upload rejected', r.status >= 400, r);
  r = await uploadVoiceIntro(L.token, 12);
  check('too-short voice intro rejected', r.status === 400 && /30–60 seconds/.test(r.data.error.message), r);
  r = await call('PUT', '/users/me/voice-intro', { token: L.token, raw: fakeAudio(100), headers: { 'Content-Type': 'audio/webm', 'X-Duration-Sec': '40' } });
  check('empty recording rejected', r.status === 400, r);
  r = await uploadVoiceIntro(L.token, 41.7, 'audio/webm;codecs=opus');
  const url: string = r.data?.user?.listenerApplication?.voiceIntroUrl ?? '';
  check('voice intro saved with a signed link', r.status === 200 && /\/media\/voice-intro_.*\.webm\?exp=\d+&sig=[a-f0-9]{64}$/.test(url), r.data);
  check('duration rounded', r.data.user.listenerApplication.voiceIntroDurationSec === 42, r.data.user.listenerApplication);

  const media = await fetch(onTestServer(url));
  const bytes = (await media.arrayBuffer()).byteLength;
  check('signed link plays the audio', media.status === 200 && media.headers.get('content-type') === 'audio/webm' && bytes === 4096, {
    status: media.status,
    type: media.headers.get('content-type'),
    bytes,
  });
  // Flip the first character of the signature
  const tampered = await fetch(onTestServer(url).replace(/sig=(.)/, (_, c: string) => `sig=${c === '0' ? '1' : '0'}`));
  check('tampered link refused', tampered.status === 403, tampered.status);
  const expired = await fetch(onTestServer(url).replace(/exp=\d+/, 'exp=1000'));
  check('expired link refused', expired.status === 403, expired.status);

  r = await call('POST', '/users/me/listener-application', { token: L.token, body: { ...application, dateOfBirth: '2012-01-01' } });
  check('under-18 applicant rejected', r.status === 400 && /18 or older/.test(r.data.error.message), r);
  r = await call('POST', '/users/me/listener-application', { token: L.token, body: application });
  check('application submitted → pending, age from DOB', r.data.user?.listenerStatus === 'pending' && r.data.user.age >= 30 && r.data.user.profileComplete, r.data);

  r = await call('GET', `/admin/users/${L.id}`, { token: admin.token });
  const app = r.data.user.listenerApplication;
  check('admin sees private details + voice link', app.fullName === 'Lata Sharma' && app.city === 'Pune' && app.voiceIntroUrl, app);
  r = await call('GET', '/users/me', { token: admin.token });
  check('private details never in public user objects', !JSON.stringify(r.data).includes('Lata Sharma'));

  await connect(L);
  const t = Date.now();
  r = await call('POST', `/admin/listener-applications/${L.id}/approve`, { token: admin.token, body: {} });
  check('approval makes a listener account', r.data.user.role === 'listener' && r.data.user.signupIntent === 'listener' && r.data.user.isAvailable, r.data.user);
  check('applicant told live', (await waitFor(L, 'account:updated', { since: t }))?.reason === 'listener_approved');
});

test('call rules: users call listeners only', async () => {
  U = await makeUser('9850000002', 'Uday', { gender: 'male' });
  U2 = await makeUser('9850000003', 'Usha');
  L2 = await makeListener('9850000004', 'Leela', admin);
  await Promise.all([connect(U), connect(U2), connect(L2)]);
  await sleep(200);

  let r = await call('GET', '/users', { token: U.token });
  const names = r.data.users.map((u: any) => u.name).sort();
  check('users only see listeners', JSON.stringify(names) === JSON.stringify(['Lata', 'Leela']), names);
  r = await call('POST', '/calls', { token: U.token, body: { userId: U2.id } });
  check('user → user call blocked', r.status === 403 && /only call listeners/.test(r.data.error.message), r);
  r = await call('POST', '/calls', { token: L.token, body: { userId: L2.id } });
  check('listener → listener call blocked', r.status === 403 && /Listeners can’t start calls/.test(r.data.error.message), r);
  r = await call('POST', '/calls', { token: L.token, body: { userId: U.id } });
  check('listener → user call blocked', r.status === 403, r);
  r = await call('POST', '/calls/match', { token: L.token, body: {} });
  check('listeners can’t use random match', r.status === 403, r);
  r = await call('GET', '/users', { token: L.token });
  check('listeners don’t browse', r.status === 403, r);
  r = await call('POST', '/wallet/recharge', { token: L.token, body: { packId: 'pack_100' } });
  check('listeners can’t buy coins', r.status === 403, r);
  r = await call('PATCH', '/users/me', { token: U.token, body: { isAvailable: true } });
  check('users can’t go "available"', r.status === 403, r);
  r = await call('PATCH', '/users/me', { token: U.token, body: { role: 'listener' } });
  check('role can’t be set directly', r.status === 400, r);
});

test('billing: coins from the user, ₹ to the listener', async () => {
  const t = Date.now();
  let r = await call('POST', '/calls', { token: U.token, body: { userId: L.id } });
  const callId = r.data.callId;
  check('user → listener call rings', r.status === 201, r);
  await waitFor(L, 'call:incoming', { since: t, where: (p) => p.callId === callId });
  await call('POST', `/calls/${callId}/accept`, { token: L.token });
  const coins = await waitFor(U, 'wallet:balance', { since: t });
  const earned = await waitFor(L, 'earnings:balance', { since: t });
  check('user charged 10 coins at pickup', coins?.balance === 40, coins);
  check('listener earns ₹2.00 (200 paise)', earned?.balancePaise === 200, earned);
  check('listener gets no coins', !L.events.some((e) => e.event === 'wallet:balance'), L.events.filter((e) => e.event === 'wallet:balance'));
  await waitFor(L, 'earnings:balance', { since: t + 500, timeout: 4000, where: (p) => p.balancePaise === 400 });
  const t2 = Date.now();
  await call('POST', `/calls/${callId}/end`, { token: U.token });
  const endU = await waitFor(U, 'call:ended', { since: t2 });
  const endL = await waitFor(L, 'call:ended', { since: t2 });
  check('user told coins spent', endU?.coins === 20 && endU.earnedPaise === 0, endU);
  check('listener told ₹ earned', endL?.earnedPaise === 400 && endL.coins === 0, endL);

  r = await call('GET', '/earnings', { token: L.token });
  check(
    'earnings summary',
    r.data.balancePaise === 400 && r.data.todayPaise === 400 && r.data.callsToday === 1 && r.data.settings.minWithdrawalPaise === 50_000,
    r.data,
  );
  check('one earnings row per call', r.data.entries.length === 1 && /Call with Uday · 2 min/.test(r.data.entries[0].description), r.data.entries);
  r = await call('GET', '/wallet', { token: L.token });
  check('listener coin wallet untouched', r.data.balance === 50, r.data.balance);
  r = await call('GET', '/calls/history', { token: L.token });
  check('listener history shows ₹ earned', r.data.calls[0]?.earnedPaise === 400 && r.data.calls[0].coins === 0, r.data.calls[0]);
  r = await call('GET', '/earnings', { token: U.token });
  check('users have no earnings page', r.status === 403, r);
});

test('payouts: details, minimum, one open request, admin pay/reject', async () => {
  let r = await call('POST', '/earnings/withdrawals', { token: L.token, body: {} });
  check('withdraw needs payout details', r.status === 400 && /UPI or bank/.test(r.data.error.message), r);
  r = await call('PUT', '/earnings/payout-method', { token: L.token, body: { kind: 'upi', upiId: 'not-a-upi', accountName: 'Lata' } });
  check('invalid UPI rejected', r.status === 400, r);
  r = await call('PUT', '/earnings/payout-method', { token: L.token, body: { kind: 'bank', accountName: 'Lata', accountNumber: '12', ifsc: 'SBIN0001234' } });
  check('invalid account number rejected', r.status === 400, r);
  r = await call('PUT', '/earnings/payout-method', { token: L.token, body: { kind: 'upi', upiId: 'lata@okicici', accountName: 'Lata Sharma' } });
  check('UPI saved, shown masked', r.data.user?.payoutMethodLabel === 'UPI · lata@okicici', r.data);
  r = await call('POST', '/earnings/withdrawals', { token: L.token, body: {} });
  check('below ₹500 refused', r.status === 400 && /₹500\.00/.test(r.data.error.message), r);

  await EarningsAccount.updateOne({ userId: L.id }, { $set: { balancePaise: 60_400 } });
  const [a, b] = await Promise.all([
    call('POST', '/earnings/withdrawals', { token: L.token, body: {} }),
    call('POST', '/earnings/withdrawals', { token: L.token, body: {} }),
  ]);
  check('two simultaneous withdrawals → exactly one', [a.status, b.status].sort().join() === '201,409', [a, b]);
  const payout = (a.status === 201 ? a : b).data.payout;
  check('whole balance requested', payout.amountPaise === 60_400 && payout.status === 'requested', payout);
  r = await call('GET', '/earnings', { token: L.token });
  check('money reserved immediately', r.data.balancePaise === 0 && r.data.payouts[0].status === 'requested', r.data);

  r = await call('GET', '/admin/payouts', { token: admin.token });
  check(
    'admin sees request with UPI details',
    r.data.payouts.length === 1 && r.data.payouts[0].method.upiId === 'lata@okicici' && r.data.payouts[0].listener.name === 'Lata',
    r.data,
  );
  r = await call('GET', '/admin/stats', { token: admin.token });
  check('stats show pending payouts', r.data.payouts.pending === 1 && r.data.payouts.pendingPaise === 60_400, r.data.payouts);

  const t = Date.now();
  r = await call('POST', `/admin/payouts/${payout.id}/reject`, { token: admin.token, body: { note: 'UPI ID inactive' } });
  check('reject payout', r.status === 204, r);
  check('listener sees money back live', (await waitFor(L, 'earnings:balance', { since: t }))?.balancePaise === 60_400);
  r = await call('POST', `/admin/payouts/${payout.id}/reject`, { token: admin.token, body: { note: 'again' } });
  check('can’t process twice', r.status === 409, r);

  r = await call('POST', '/earnings/withdrawals', { token: L.token, body: { amountPaise: 50_000 } });
  check('partial withdrawal', r.status === 201 && r.data.payout.amountPaise === 50_000, r.data);
  r = await call('POST', `/admin/payouts/${r.data.payout.id}/paid`, { token: admin.token, body: { reference: 'UTR123456789' } });
  check('mark paid', r.status === 204, r);
  r = await call('GET', '/earnings', { token: L.token });
  check(
    'history after payout',
    r.data.balancePaise === 10_400 &&
      r.data.payouts[0].status === 'paid' &&
      r.data.payouts[0].reference === 'UTR123456789' &&
      r.data.entries.some((e: any) => /Withdrawal paid · ref UTR123456789/.test(e.description)) &&
      r.data.entries.some((e: any) => e.type === 'payout_reversal'),
    r.data,
  );
});

test('rooms: listeners host, users join, applicants wait', async () => {
  let r = await call('POST', '/rooms', { token: U.token, body: { title: 'User room', topic: 'Career', language: 'Hindi' } });
  check('users can’t host rooms', r.status === 403 && /host voice rooms/.test(r.data.error.message), r);
  r = await call('POST', '/rooms', { token: L.token, body: { title: 'Lata’s circle', topic: 'Career', language: 'Hindi' } });
  check('listener hosts a room', r.status === 201, r);
  const roomId = r.data.room.id;
  r = await call('POST', `/rooms/${roomId}/join`, { token: U.token });
  check('user joins', r.status === 200, r);
  const applicant = await login('9850000005');
  await call('POST', '/users/me/intent', { token: applicant.token, body: { intent: 'listener' } });
  await call('PATCH', '/users/me', { token: applicant.token, body: basics('Pending P') });
  r = await call('POST', `/rooms/${roomId}/join`, { token: applicant.token });
  check('signup applicant can’t join rooms while pending', r.status === 403, r);
  await call('POST', `/rooms/${roomId}/leave`, { token: L.token });
});

test('later applicant, rejection, continue as user, revoke', async () => {
  // A normal user applying later keeps using the app while pending
  await uploadVoiceIntro(U.token, 33, 'audio/mp4');
  let r = await call('POST', '/users/me/listener-application', {
    token: U.token,
    body: { fullName: 'Uday Kumar', dateOfBirth: '1990-01-01', city: 'Delhi', about: 'I want to help people who feel lonely at night.' },
  });
  check('existing user applies later', r.data.user?.listenerStatus === 'pending' && r.data.user.signupIntent === 'user', r.data);
  r = await call('GET', '/users', { token: U.token });
  check('…and can still browse/call while pending', r.status === 200, r);
  r = await call('POST', '/users/me/intent', { token: U.token, body: { intent: 'listener' } });
  check('existing user can’t switch intent directly', r.status === 400, r);

  // Signup applicant rejected → continues as a normal user
  const R = await login('9850000006');
  await call('POST', '/users/me/intent', { token: R.token, body: { intent: 'listener' } });
  await call('PATCH', '/users/me', { token: R.token, body: { name: 'Ravi', gender: 'male', languages: ['Tamil'] } });
  await uploadVoiceIntro(R.token, 45);
  await call('POST', '/users/me/listener-application', {
    token: R.token,
    body: { fullName: 'Ravi Iyer', dateOfBirth: '1988-07-21', city: 'Chennai', about: 'Teacher, patient listener, happy to help.' },
  });
  await call('POST', `/admin/listener-applications/${R.id}/reject`, { token: admin.token, body: { note: 'Voice intro was not clear' } });
  r = await call('GET', '/users/me', { token: R.token });
  check('applicant sees rejection reason', r.data.user.listenerStatus === 'rejected' && r.data.user.listenerApplication.note === 'Voice intro was not clear', r.data.user);
  r = await call('GET', '/users', { token: R.token });
  check('rejected applicant still restricted until choosing', r.status === 403, r);
  await call('POST', '/users/me/intent', { token: R.token, body: { intent: 'user' } });
  r = await call('GET', '/users', { token: R.token });
  check('…“continue as a normal user” unlocks the app', r.status === 200, r);

  // Revoked listener becomes a user; their paused coins work again
  r = await call('POST', `/admin/users/${L2.id}/revoke-listener`, { token: admin.token, body: { note: 'Inactive for 30 days' } });
  check('revoke → normal user', r.data.user.role === 'user' && r.data.user.signupIntent === 'user', r.data.user);
  r = await call('POST', '/calls', { token: L2.token, body: { userId: L.id } });
  check('ex-listener can now call with their paused coins', r.status === 201, r);
  if (r.data?.callId) await call('POST', `/calls/${r.data.callId}/end`, { token: L2.token });
});
