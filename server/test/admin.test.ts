// Admin: access control, listener applications, wallet adjustments, reports & bans, search, stats, audit log
import {
  call,
  check,
  connect,
  makeAdmin,
  makeUser,
  sleep,
  startTestServer,
  stopTestServer,
  uploadVoiceIntro,
  waitFor,
  type TestUser,
} from './helpers';

import { after, before, test } from 'node:test';

import { setAdminByPhone } from '../src/modules/admin/admin.service';

before(() => startTestServer('admin'));
after(stopTestServer);

let Adm: TestUser;
let U: TestUser; // becomes a listener, later banned
let V: TestUser;
let W: TestUser;
let Y: TestUser;

const application = (about: string) => ({ fullName: 'Test Person', dateOfBirth: '1993-03-03', city: 'Jaipur', about });

test('make-admin and access control', async () => {
  Adm = await makeUser('9830000001', 'Admin');
  U = await makeUser('9830000002', 'Uma');
  V = await makeUser('9830000003', 'Veena');
  W = await makeUser('9830000004', 'Wasim');
  Y = await makeUser('9830000005', 'Yash');

  check('unknown phone → no user', (await setAdminByPhone('+919899999999', true)) === null);
  let r = await call('GET', '/admin/stats', { token: Adm.token });
  check('non-admin gets 403', r.status === 403, r);
  r = await call('GET', '/admin/stats');
  check('no token gets 401', r.status === 401, r);
  check('make-admin grants admin', (await makeAdmin(Adm))?.isAdmin === true);
  r = await call('GET', '/admin/stats', { token: Adm.token });
  check('admin can read stats', r.status === 200 && r.data.users.total === 5, r.data);
  r = await call('GET', '/users/me', { token: Adm.token });
  check('isAdmin exposed on /users/me', r.data.user.isAdmin === true, r.data.user);
});

test('listener applications: approve, reject, re-apply, revoke', async () => {
  let r = await call('PATCH', '/users/me', { token: U.token, body: { role: 'listener' } });
  check('cannot self-promote to listener', r.status === 400, r);
  r = await call('POST', '/users/me/listener-application', { token: U.token, body: application('I volunteer on a helpline and love listening to people.') });
  check('application needs a voice intro', r.status === 400 && /voice intro/.test(r.data.error.message), r);
  await uploadVoiceIntro(U.token);
  r = await call('POST', '/users/me/listener-application', { token: U.token, body: application('short') });
  check('application needs 20+ chars', r.status === 400, r);
  r = await call('POST', '/users/me/listener-application', { token: U.token, body: application('I volunteer on a helpline and love listening to people.') });
  check('application submitted → pending', r.status === 200 && r.data.user.listenerStatus === 'pending' && r.data.user.role === 'user', r.data);
  r = await call('POST', '/users/me/listener-application', { token: U.token, body: application('I volunteer on a helpline and love listening to people!!') });
  check('editing a pending application keeps it pending', r.status === 200 && r.data.user.listenerStatus === 'pending', r.data);

  r = await call('GET', '/admin/listener-applications', { token: Adm.token });
  check('admin sees pending application with text', r.data.applications.length === 1 && /helpline/.test(r.data.applications[0].listenerApplication.about), r.data);
  r = await call('GET', '/admin/stats', { token: Adm.token });
  check('stats count pending applications', r.data.listeners.pendingApplications === 1, r.data.listeners);

  await connect(U);
  const t = Date.now();
  r = await call('POST', `/admin/listener-applications/${U.id}/approve`, { token: Adm.token, body: {} });
  check('approve → listener & available', r.status === 200 && r.data.user.role === 'listener' && r.data.user.isAvailable === true, r.data);
  check('user notified live of approval', (await waitFor(U, 'account:updated', { since: t }))?.reason === 'listener_approved');
  r = await call('POST', `/admin/listener-applications/${U.id}/approve`, { token: Adm.token, body: {} });
  check('approving twice → 409', r.status === 409, r);

  await uploadVoiceIntro(V.token);
  await call('POST', '/users/me/listener-application', { token: V.token, body: application('Psychology student, happy to help anyone.') });
  r = await call('POST', `/admin/listener-applications/${V.id}/reject`, { token: Adm.token, body: {} });
  check('reject needs a note', r.status === 400, r);
  r = await call('POST', `/admin/listener-applications/${V.id}/reject`, { token: Adm.token, body: { note: 'Profile incomplete' } });
  check('reject → rejected', r.data.user.listenerStatus === 'rejected' && r.data.user.role === 'user', r.data);
  r = await call('POST', '/users/me/listener-application', { token: V.token, body: application('Updated my profile, please review again.') });
  check('rejected user may re-apply', r.data.user?.listenerStatus === 'pending', r.data);

  const t2 = Date.now();
  r = await call('POST', `/admin/users/${U.id}/revoke-listener`, { token: Adm.token, body: { note: 'Too many complaints' } });
  check('revoke listener', r.data.user.role === 'user' && r.data.user.listenerStatus === 'rejected', r.data);
  check('user notified of revoke', (await waitFor(U, 'account:updated', { since: t2 }))?.reason === 'listener_revoked');

  // U becomes a listener again for the ban-during-call test
  await call('POST', '/users/me/listener-application', { token: U.token, body: application('Second chance, I will do better than before.') });
  await call('POST', `/admin/listener-applications/${U.id}/approve`, { token: Adm.token, body: {} });
});

test('wallet adjustments', async () => {
  await connect(V);
  const t = Date.now();
  let r = await call('POST', `/admin/users/${V.id}/wallet-adjustment`, { token: Adm.token, body: { amount: 100, reason: 'Refund for dropped call' } });
  check('credit adjustment', r.status === 200 && r.data.balance === 150, r.data);
  check('user sees new balance live', (await waitFor(V, 'wallet:balance', { since: t }))?.balance === 150);
  r = await call('POST', `/admin/users/${V.id}/wallet-adjustment`, { token: Adm.token, body: { amount: -1000, reason: 'Too much' } });
  check('debit beyond balance refused', r.status === 400 && r.data.error.code === 'INSUFFICIENT_BALANCE', r);
  r = await call('POST', `/admin/users/${V.id}/wallet-adjustment`, { token: Adm.token, body: { amount: 0, reason: 'Nothing' } });
  check('zero amount refused', r.status === 400, r);
  r = await call('GET', '/wallet', { token: V.token });
  check('adjustment in user’s history', r.data.transactions[0].type === 'adjustment' && /Refund/.test(r.data.transactions[0].description), r.data.transactions[0]);
});

test('reports and bans', async () => {
  await call('POST', `/users/${U.id}/report`, { token: V.token, body: { reason: 'spam', details: 'keeps sending links' } });
  let r = await call('GET', '/admin/reports', { token: Adm.token });
  const rep = r.data.reports[0];
  check('report listed with both users', rep?.reporter?.name === 'Veena' && rep.reported?.name === 'Uma' && rep.reportedOpenReports === 1, rep);
  r = await call('POST', `/admin/reports/${rep.id}/resolve`, { token: Adm.token, body: { status: 'reviewed', note: 'No evidence' } });
  check('resolve report', r.status === 204, r);
  r = await call('POST', `/admin/reports/${rep.id}/resolve`, { token: Adm.token, body: { status: 'reviewed' } });
  check('resolving twice → 409', r.status === 409, r);
  r = await call('GET', '/admin/reports?status=reviewed', { token: Adm.token });
  check('resolved report moves to reviewed list', r.data.reports[0]?.resolutionNote === 'No evidence', r.data);

  // A ban during an active call ends the call for the other person
  await connect(Y);
  await sleep(150);
  let t = Date.now();
  r = await call('POST', '/calls', { token: Y.token, body: { userId: U.id } });
  const callId = r.data.callId;
  await waitFor(U, 'call:incoming', { since: t });
  await call('POST', `/calls/${callId}/accept`, { token: U.token });

  await call('POST', `/users/${U.id}/report`, { token: W.token, body: { reason: 'harassment' } });
  r = await call('GET', '/admin/reports', { token: Adm.token });
  t = Date.now();
  r = await call('POST', `/admin/reports/${r.data.reports[0].id}/resolve`, {
    token: Adm.token,
    body: { status: 'actioned', note: 'Harassment confirmed', ban: true },
  });
  check('resolve with ban', r.status === 204, r);
  const ended = await waitFor(Y, 'call:ended', { since: t, where: (p) => p.callId === callId });
  check('other side’s call ends when user is banned', ended?.reason === 'peer_disconnected', ended);
  check('banned user’s socket is disconnected', !!(await waitFor(U, 'disconnect', { since: t })));
  r = await call('GET', '/users/me', { token: U.token });
  check('banned user’s token → 403 suspended', r.status === 403 && /suspended/.test(r.data.error.message), r);
  r = await call('POST', '/auth/refresh', { body: { refreshToken: U.refresh } });
  check('banned user’s sessions revoked', r.status === 401, r);
  await sleep(1100);
  await call('POST', '/auth/otp/request', { body: { phone: U.phone } });
  r = await call('POST', '/auth/otp/verify', { body: { phone: U.phone, code: '123456' } });
  check('banned user can’t log back in', r.status === 403, r);
  r = await call('GET', '/users', { token: V.token });
  check('banned user hidden from discover', !r.data.users.some((u: any) => u.id === U.id), r.data);
  r = await call('POST', `/admin/users/${U.id}/ban`, { token: Adm.token, body: { reason: 'again' } });
  check('banning twice → 409', r.status === 409, r);

  r = await call('POST', `/admin/users/${Adm.id}/ban`, { token: Adm.token, body: { reason: 'oops' } });
  check('admin can’t ban self', r.status === 400, r);
  await makeAdmin(W);
  r = await call('POST', `/admin/users/${W.id}/ban`, { token: Adm.token, body: { reason: 'nope' } });
  check('admins can’t be banned', r.status === 403, r);
  await makeAdmin(W, false);

  r = await call('POST', `/admin/users/${U.id}/unban`, { token: Adm.token });
  check('unban', r.status === 200 && r.data.user.status === 'active', r.data);
  await sleep(1100);
  await call('POST', '/auth/otp/request', { body: { phone: U.phone } });
  r = await call('POST', '/auth/otp/verify', { body: { phone: U.phone, code: '123456' } });
  check('unbanned user can log in again', r.status === 200, r);
  U.token = r.data.accessToken;
  U.events = [];
  await connect(U);
});

test('search, user detail, rooms, stats, audit log', async () => {
  let r = await call('GET', '/admin/users?q=veen', { token: Adm.token });
  check('search by name (case-insensitive, partial)', r.data.users.length === 1 && r.data.users[0].name === 'Veena', r.data);
  r = await call('GET', '/admin/users?q=0000003', { token: Adm.token });
  check('search by phone digits', r.data.users.length === 1 && r.data.users[0].id === V.id, r.data);
  r = await call('GET', `/admin/users?q=${encodeURIComponent('(.*)')}`, { token: Adm.token });
  check('regex characters are escaped', r.status === 200 && r.data.users.length === 0, r.data);
  r = await call('GET', '/admin/users?listenerStatus=pending', { token: Adm.token });
  check('filter by listener status', r.data.users.length === 1 && r.data.users[0].id === V.id, r.data);

  r = await call('GET', `/admin/users/${U.id}`, { token: Adm.token });
  check(
    'user detail: wallet, calls, reports, audit',
    r.data.user.phone === '+919830000002' && r.data.calls.length === 1 && r.data.reports.against.length === 2 && r.data.auditLog.length >= 5,
    { calls: r.data.calls?.length, reports: r.data.reports, audit: r.data.auditLog?.length },
  );

  r = await call('POST', '/rooms', { token: U.token, body: { title: 'Late night chat', topic: 'Late night talks', language: 'Hindi' } });
  const roomId = r.data.room.id;
  const t = Date.now();
  r = await call('POST', `/admin/rooms/${roomId}/end`, { token: Adm.token });
  check('admin ends a room', r.status === 204, r);
  check('host notified room closed', (await waitFor(U, 'room:closed', { since: t }))?.roomId === roomId);
  r = await call('POST', `/admin/rooms/${roomId}/end`, { token: Adm.token });
  check('ending an ended room → 404', r.status === 404, r);

  r = await call('GET', '/admin/stats', { token: Adm.token });
  check(
    'stats shape',
    r.data.users.total === 5 && r.data.calls.completed24h === 1 && r.data.rooms.live === 0 && r.data.reports.open === 0,
    r.data,
  );
  r = await call('GET', '/admin/audit-log', { token: Adm.token });
  const actions = r.data.actions.map((a: any) => a.action);
  check(
    'audit log records every action',
    ['approve_listener', 'reject_listener', 'revoke_listener', 'adjust_wallet', 'resolve_report', 'ban_user', 'unban_user', 'end_room'].every((a) =>
      actions.includes(a),
    ),
    actions,
  );
});
