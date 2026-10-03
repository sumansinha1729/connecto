// Admin panel: admin-only login, monitoring data (live, metrics, safety), no actions on your own account
import {
  call,
  check,
  connect,
  lastOtp,
  makeAdmin,
  makeListener,
  makeUser,
  sleep,
  startTestServer,
  stopTestServer,
  uploadVoiceIntro,
  waitFor,
  type TestUser,
} from './helpers';

import { after, before, test } from 'node:test';

import { User } from '../src/modules/users/user.model';

before(() => startTestServer('adminpanel'));
after(stopTestServer);

let admin: TestUser;
let admin2: TestUser;
let U: TestUser;
let L: TestUser;

test('admin login: only admins, never creates accounts', async () => {
  admin = await makeUser('9840000001', 'Asha Admin');
  await makeAdmin(admin);
  U = await makeUser('9840000002', 'Uday');

  // A number that has never used the app
  let r = await call('POST', '/auth/admin/otp/request', { body: { phone: '9840000099' } });
  check('unknown number gets the normal response (nothing revealed)', r.status === 200 && r.data.expiresInSec > 0, r);
  check('…but no code is sent', lastOtp('+919840000099') === undefined);
  r = await call('POST', '/auth/admin/otp/verify', { body: { phone: '9840000099', code: '123456' } });
  check('unknown number can’t log in', r.status === 403 && /admin access/.test(r.data.error.message), r);
  check('…and no account was created', !(await User.exists({ phone: '+919840000099' })));

  // A normal app user (wait out the resend limit from their app login)
  await sleep(1100);
  await call('POST', '/auth/admin/otp/request', { body: { phone: U.phone } });
  r = await call('POST', '/auth/admin/otp/verify', { body: { phone: U.phone, code: '123456' } });
  check('app users can’t log in to the panel', r.status === 403, r);

  // An admin
  await sleep(1100);
  r = await call('POST', '/auth/admin/otp/request', { body: { phone: admin.phone } });
  check('admin gets a code by SMS', r.status === 200 && /^\d{6}$/.test(lastOtp(`+91${admin.phone}`) ?? ''), r);
  r = await call('POST', '/auth/admin/otp/verify', { body: { phone: admin.phone, code: lastOtp(`+91${admin.phone}`) } });
  check('admin logs in', r.status === 200 && r.data.accessToken && r.data.user.isAdmin === true, r);
  admin.token = r.data.accessToken;

  r = await call('GET', '/admin/monitoring/live', { token: U.token });
  check('monitoring is admins only', r.status === 403, r);
});

test('live: online people, calls in progress, live rooms', async () => {
  L = await makeListener('9840000003', 'Lata', admin);
  const L2 = await makeListener('9840000004', 'Leela', admin);
  await Promise.all([connect(U), connect(L), connect(L2)]);
  await sleep(200);

  let r = await call('GET', '/admin/monitoring/live', { token: admin.token });
  check('counts who is online', r.data.people.usersOnline === 1 && r.data.people.listenersOnline === 2 && r.data.people.listenersAvailable === 2, r.data.people);

  const t = Date.now();
  r = await call('POST', '/calls', { token: U.token, body: { userId: L.id } });
  const callId = r.data.callId;
  r = await call('GET', '/admin/monitoring/live', { token: admin.token });
  check('ringing call listed', r.data.ringing.length === 1 && r.data.ringing[0].listener.name === 'Lata', r.data.ringing);
  await waitFor(L, 'call:incoming', { since: t });
  await call('POST', `/calls/${callId}/accept`, { token: L.token });
  await call('POST', '/rooms', { token: L2.token, body: { title: 'Night owls', topic: 'Music', language: 'Hindi' } });

  r = await call('GET', '/admin/monitoring/live', { token: admin.token });
  const live = r.data.calls[0];
  check('call in progress: who, how long, coins so far', r.data.calls.length === 1 && live.caller.name === 'Uday' && live.listener.name === 'Lata' && live.coins === 10 && live.earnedPaise === 200, live);
  check('listener in a call is not "available"', r.data.people.listenersInCall === 1 && r.data.people.listenersAvailable === 1, r.data.people);
  check('live room with host and size', r.data.rooms.length === 1 && r.data.rooms[0].host.name === 'Leela' && r.data.rooms[0].participants === 1, r.data.rooms);

  await call('POST', `/calls/${callId}/end`, { token: U.token });
});

test('metrics: activity, money, busiest hours, top listeners', async () => {
  let r = await call('GET', '/admin/monitoring/metrics?period=today', { token: admin.token });
  const m = r.data;
  check('today has 24 hourly buckets', m.series.length === 24 && m.busiestHours.length === 24, m.series.length);
  check('totals: signups, calls, coins, listener earnings', m.totals.signups === 4 && m.totals.calls === 1 && m.totals.coinsSpent === 10 && m.totals.listenerEarningsPaise === 200, m.totals);
  check('answer rate', m.totals.answerRate === 100, m.totals);
  check('dev recharges are not counted as money', m.totals.rechargeInr === 0, m.totals);
  check('top listener', m.topListeners[0]?.listener.name === 'Lata' && m.topListeners[0].calls === 1, m.topListeners);
  check('busiest hour has the call', m.busiestHours.reduce((n: number, h: any) => n + h.calls, 0) === 1, m.busiestHours);

  r = await call('GET', '/admin/monitoring/metrics?period=7d', { token: admin.token });
  check('7 days = 7 daily buckets, today last', r.data.series.length === 7 && r.data.series[6].calls === 1, r.data.series);
  r = await call('GET', '/admin/monitoring/metrics?period=30d', { token: admin.token });
  check('30 days = 30 buckets', r.data.series.length === 30, r.data.series.length);
  r = await call('GET', '/admin/monitoring/metrics?period=year', { token: admin.token });
  check('unknown period rejected', r.status === 400, r);
});

test('safety: most reported, listeners ending calls instantly, audit trail', async () => {
  const V = await makeUser('9840000005', 'Veena');
  await call('POST', `/users/${L.id}/report`, { token: U.token, body: { reason: 'harassment' } });
  await call('POST', `/users/${L.id}/report`, { token: V.token, body: { reason: 'spam' } });

  // Lata picks up and hangs up immediately, three times
  await call('POST', '/wallet/recharge', { token: U.token, body: { packId: 'pack_100' } });
  for (let i = 0; i < 3; i++) {
    const t = Date.now();
    const r = await call('POST', '/calls', { token: U.token, body: { userId: L.id } });
    await waitFor(L, 'call:incoming', { since: t });
    await call('POST', `/calls/${r.data.callId}/accept`, { token: L.token });
    await call('POST', `/calls/${r.data.callId}/end`, { token: L.token });
  }

  const r = await call('GET', '/admin/monitoring/safety', { token: admin.token });
  const s = r.data;
  check('open reports counted', s.openReports === 2, s.openReports);
  check('reasons this week', s.reportsThisWeek.length === 2, s.reportsThisWeek);
  check('most reported person', s.mostReported[0]?.user.name === 'Lata' && s.mostReported[0].openReports === 2, s.mostReported);
  check('listener ending calls instantly is flagged', s.shortCallListeners[0]?.listener.name === 'Lata' && s.shortCallListeners[0].shortCalls === 3, s.shortCallListeners);
  check('recent admin actions', s.recentAdminActions.some((a: any) => a.action === 'approve_listener' && a.admin.name === 'Asha Admin'), s.recentAdminActions);
});

test('admins can’t approve, credit or pay themselves', async () => {
  admin2 = await makeUser('9840000006', 'Second Admin');
  await makeAdmin(admin2);

  let r = await call('POST', `/admin/users/${admin.id}/wallet-adjustment`, { token: admin.token, body: { amount: 500, reason: 'Free coins' } });
  check('can’t add coins to your own wallet', r.status === 403 && /Another admin/.test(r.data.error.message), r);
  r = await call('POST', `/admin/users/${admin.id}/wallet-adjustment`, { token: admin2.token, body: { amount: 50, reason: 'Goodwill' } });
  check('another admin can', r.status === 200, r);

  await uploadVoiceIntro(admin.token);
  await call('POST', '/users/me/listener-application', {
    token: admin.token,
    body: { fullName: 'Asha Admin', dateOfBirth: '1990-01-01', city: 'Delhi', about: 'I would also like to help as a listener.' },
  });
  r = await call('POST', `/admin/listener-applications/${admin.id}/approve`, { token: admin.token, body: {} });
  check('can’t approve your own application', r.status === 403, r);
  r = await call('POST', `/admin/listener-applications/${admin.id}/approve`, { token: admin2.token, body: {} });
  check('another admin can', r.status === 200, r);
});
