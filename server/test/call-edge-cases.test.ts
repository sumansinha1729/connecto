// Calls under pressure: racing taps and timers, running out of coins, lost connections,
// two devices on one account, deleted accounts, and billing that always adds up.
import {
  call,
  check,
  connect,
  makeAdmin,
  makeListener,
  makeUser,
  sleep,
  startTestServer,
  stopTestServer,
  waitFor,
  type TestUser,
} from './helpers';

import { after, before, test } from 'node:test';

import { env } from '../src/config/env';
import { Call } from '../src/modules/calls/call.model';
import { EarningsEntry } from '../src/modules/earnings/earnings.model';
import { User } from '../src/modules/users/user.model';
import { Transaction, Wallet } from '../src/modules/wallet/wallet.model';

before(() => startTestServer('calledges'));
after(stopTestServer);

const RATE = env.CALL_RATE_COINS_PER_MIN; // 10 coins
const EARN = env.LISTENER_EARNING_PAISE_PER_MIN; // ₹2.00
const RING_MS = env.CALL_RING_TIMEOUT_SEC * 1000; // 3 s in tests

let admin: TestUser;
let A: TestUser; // user (caller)
let L: TestUser; // listener
let M: TestUser; // listener

const start = (from: TestUser, to: TestUser, deviceId?: string) => call('POST', '/calls', { token: from.token, body: { userId: to.id, deviceId } });
const accept = (by: TestUser, id: string, deviceId?: string) => call('POST', `/calls/${id}/accept`, { token: by.token, body: deviceId ? { deviceId } : undefined });
const end = (by: TestUser, id: string) => call('POST', `/calls/${id}/end`, { token: by.token });
const balance = async (u: TestUser) => (await call('GET', '/wallet', { token: u.token })).data.balance as number;
const topUp = (u: TestUser) => call('POST', '/wallet/recharge', { token: u.token, body: { packId: 'pack_600' } });
const isFree = async (u: TestUser) => !(await User.findById(u.id).lean())?.activeCallId;

test('setup', async () => {
  admin = await makeUser('9812000009', 'Admin');
  await makeAdmin(admin);
  A = await makeUser('9812000001', 'Arun');
  L = await makeListener('9812000002', 'Lata', admin);
  M = await makeListener('9812000003', 'Meera', admin);
  await Promise.all([connect(A), connect(L), connect(M)]);
  await topUp(A);
  await sleep(150);
});

test('double tap on Call: exactly one call starts', async () => {
  const [r1, r2] = await Promise.all([start(A, L), start(A, L)]);
  const ok = [r1, r2].filter((r) => r.status === 201);
  const refused = [r1, r2].filter((r) => r.status === 409);
  check('one call started, the other refused', ok.length === 1 && refused.length === 1, [r1, r2]);
  check('only one call exists', (await Call.countDocuments({ callerId: A.id, status: 'ringing' })) === 1);
  await end(A, ok[0].data.callId);
  check('both free again', (await isFree(A)) && (await isFree(L)));
});

test('answering just as the ring times out never marks an answered call as missed', async () => {
  for (const delay of [RING_MS - 40, RING_MS - 10, RING_MS, RING_MS + 15]) {
    const r = await start(A, L);
    check('call starts', r.status === 201, r);
    const id = r.data.callId;
    await sleep(delay);
    const a = await accept(L, id);
    await sleep(100);
    if (a.status === 200) {
      const live = await Call.findById(id).lean();
      check(`answered at ${delay}ms stays active`, live?.status === 'active', live);
      await end(A, id);
      const done = await Call.findById(id).lean();
      check(`answered at ${delay}ms ends as completed`, done?.status === 'completed' && done.billedMinutes >= 1, done);
    } else {
      const done = await Call.findById(id).lean();
      check(`too late at ${delay}ms: missed and not charged`, a.status === 404 && done?.status === 'missed' && done.coinsCharged === 0, { a, done });
    }
    check('both free again', (await isFree(A)) && (await isFree(L)));
  }
});

test('caller hangs up exactly as the listener answers: a consistent result either way', async () => {
  for (let i = 0; i < 6; i++) {
    const before = await balance(A);
    const r = await start(A, L);
    const id = r.data.callId;
    await sleep(50);
    const [a] = await Promise.all([accept(L, id), end(A, id)]);
    await sleep(150);
    const done = await Call.findById(id).lean();
    const after = await balance(A);
    if (done?.status === 'cancelled') {
      check('cancelled: nothing charged', done.coinsCharged === 0 && after === before && a.status !== 200, { a: a.status, done, before, after });
    } else {
      // The answer won: the call connected and was hung up straight away (or the accept saw it end)
      check('answered then ended: one minute charged and earned', done?.status === 'completed' && done.coinsCharged === RATE && done.earnedPaise === EARN && after === before - RATE, {
        a: a.status,
        done,
      });
    }
    check('both free again', (await isFree(A)) && (await isFree(L)));
  }
});

test('“Decline” on a call that is already connected hangs up instead', async () => {
  const r = await start(A, L);
  const id = r.data.callId;
  await accept(L, id);
  const t = Date.now();
  const d = await call('POST', `/calls/${id}/reject`, { token: L.token });
  check('reject answers 204', d.status === 204, d);
  const done = await Call.findById(id).lean();
  check('stored as a completed call, not “declined”', done?.status === 'completed' && done.endReason === 'hangup', done);
  const ended = await waitFor(A, 'call:ended', { since: t, where: (p) => p.callId === id });
  check('caller is told the listener ended it', ended?.reason === 'peer_hangup' && ended.coins === RATE, ended);
});

test('out of coins at pickup: the call never starts and isn’t counted', async () => {
  // Leave the caller with 15 coins, then spend 10 elsewhere while it rings
  await call('POST', `/admin/users/${A.id}/wallet-adjustment`, { token: admin.token, body: { amount: -((await balance(A)) - 15), reason: 'Test: leave 15' } });
  const calls = (await User.findById(A.id).lean())!.totalCalls;
  const r = await start(A, M);
  check('starts with 15 coins', r.status === 201, r);
  const id = r.data.callId;
  await call('POST', `/admin/users/${A.id}/wallet-adjustment`, { token: admin.token, body: { amount: -10, reason: 'Test: spend' } });
  const t = Date.now();
  const a = await accept(M, id);
  check('answer refused: caller ran out', a.status === 409 && /ran out of coins/.test(a.data.error.message), a);
  const done = await Call.findById(id).lean();
  check('stored as cancelled, 0 s, nothing charged', done?.status === 'cancelled' && done.durationSec === 0 && done.coinsCharged === 0 && done.earnedPaise === 0, done);
  check('not counted as a call', (await User.findById(A.id).lean())!.totalCalls === calls);
  const ended = await waitFor(A, 'call:ended', { since: t, where: (p) => p.callId === id });
  check('caller told why', ended?.reason === 'insufficient_balance', ended);
  check('balance untouched (5)', (await balance(A)) === 5);
  check('both free again', (await isFree(A)) && (await isFree(M)));
  await topUp(A);
});

test('two devices on one account: the answering device is named', async () => {
  const r = await start(A, L, 'caller-phone-1');
  const id = r.data.callId;
  let active = await call('GET', '/calls/active', { token: L.token });
  check('while ringing, every listener device may show it', active.data.call?.deviceId === null, active.data);
  active = await call('GET', '/calls/active', { token: A.token });
  check('caller’s device is remembered', active.data.call?.deviceId === 'caller-phone-1', active.data);

  const t = Date.now();
  await accept(L, id, 'listener-phone-2');
  const ev = await waitFor(L, 'call:accepted', { since: t, where: (p) => p.callId === id });
  check('call:accepted says which device answered', ev?.deviceId === 'listener-phone-2', ev);
  active = await call('GET', '/calls/active', { token: L.token });
  check('…and /calls/active too (other devices stay out)', active.data.call?.deviceId === 'listener-phone-2', active.data);
  const bad = await call('POST', `/calls/${id}/accept`, { token: L.token, body: { deviceId: 'no spaces allowed!' } });
  check('malformed device id refused', bad.status === 400, bad);
  await end(A, id);
});

test('caller loses connection mid-call: the call ends and billing stops', async () => {
  const r = await start(A, L);
  const id = r.data.callId;
  await accept(L, id);
  const t = Date.now();
  A.socket!.disconnect();
  const ended = await waitFor(L, 'call:ended', { since: t, timeout: env.PRESENCE_GRACE_SEC * 1000 + 3000, where: (p) => p.callId === id });
  check('listener told the caller lost connection', ended?.reason === 'peer_disconnected', ended);
  const done = await Call.findById(id).lean();
  const charged = done!.coinsCharged;
  await sleep(env.billingIntervalSec * 1000 + 500);
  check('no billing after the call ended', (await Call.findById(id).lean())!.coinsCharged === charged);
  check('both free again', (await isFree(A)) && (await isFree(L)));
  await connect(A);
  await sleep(150);
});

test('deleting your account mid-call ends the call', async () => {
  const Z = await makeUser('9812000005', 'Zoya');
  await connect(Z);
  await sleep(100);
  const r = await start(Z, M);
  const id = r.data.callId;
  await accept(M, id);
  const t = Date.now();
  const del = await call('DELETE', '/users/me', { token: Z.token });
  check('account deleted', del.status === 204, del);
  const ended = await waitFor(M, 'call:ended', { since: t, where: (p) => p.callId === id });
  check('listener’s call ends at once', Boolean(ended), ended);
  const charged = (await Call.findById(id).lean())!.coinsCharged;
  await sleep(env.billingIntervalSec * 1000 + 500);
  check('no more billing', (await Call.findById(id).lean())!.coinsCharged === charged);
  check('listener free again', await isFree(M));
});

test('billing always adds up', async () => {
  const calls = await Call.find({}).lean();
  check('no call left open', calls.every((c) => ['completed', 'missed', 'rejected', 'cancelled'].includes(c.status)), calls.map((c) => c.status));
  for (const c of calls) {
    const ok = c.coinsCharged === c.billedMinutes * RATE && c.earnedPaise === c.billedMinutes * EARN;
    check(`call ${c._id}: coins and earnings match minutes billed`, ok, c);
    if (c.status !== 'completed') check(`call ${c._id}: unanswered/cancelled calls cost nothing`, c.coinsCharged === 0 && c.durationSec === 0, c);
  }
  const charged = calls.reduce((n, c) => n + c.coinsCharged, 0);
  const ledger = await Transaction.aggregate([{ $match: { type: 'call_charge' } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]);
  check('coin ledger matches the calls', -(ledger[0]?.sum ?? 0) === charged, { ledger, charged });
  const earned = calls.reduce((n, c) => n + c.earnedPaise, 0);
  const entries = await EarningsEntry.aggregate([{ $match: { type: 'call' } }, { $group: { _id: null, sum: { $sum: '$amountPaise' } } }]);
  check('earnings ledger matches the calls', (entries[0]?.sum ?? 0) === earned, { entries, earned });
  check('no wallet below zero', !(await Wallet.exists({ balance: { $lt: 0 } })));
  check('nobody stuck “on a call”', !(await User.exists({ activeCallId: { $ne: null } })));
});
