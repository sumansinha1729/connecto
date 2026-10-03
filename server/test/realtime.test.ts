// Presence, call signalling and per-minute billing, ratings, random match, voice rooms
import {
  call,
  check,
  connect,
  connectError,
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

before(() => startTestServer('realtime'));
after(stopTestServer);

let A: TestUser; // user
let F: TestUser; // user
let B: TestUser; // listener, speaks Hindi + English
let C: TestUser; // listener, speaks Tamil
let D: TestUser; // listener, stays offline
let callId: string;
const byCall = (id: string) => ({ where: (p: any) => p.callId === id });

test('presence', async () => {
  const admin = await makeUser('9810000009', 'Admin');
  await makeAdmin(admin);
  A = await makeUser('9810000001', 'Aman', { gender: 'male', age: 25 });
  F = await makeUser('9810000005', 'Farah', { age: 25 });
  B = await makeListener('9810000002', 'Bela', admin, { languages: ['Hindi', 'English'] });
  C = await makeListener('9810000003', 'Charu', admin, { languages: ['Tamil'] });
  D = await makeListener('9810000004', 'Dev', admin);

  let r = await call('GET', `/users/${B.id}`, { token: A.token });
  check('offline before connecting', r.data.user.isOnline === false, r.data.user);
  await Promise.all([connect(A), connect(B), connect(C), connect(F)]);
  await sleep(150);
  r = await call('GET', `/users/${B.id}`, { token: A.token });
  check('online after socket connects', r.data.user.isOnline === true, r.data.user);
  check('socket with bad token rejected', (await connectError('bad')) === 'UNAUTHORIZED');
});

test('call: start, busy, accept, billing, hang up', async () => {
  let r = await call('POST', '/calls', { token: A.token, body: { userId: D.id } });
  check('calling an offline listener → USER_UNAVAILABLE', r.status === 409 && r.data.error.code === 'USER_UNAVAILABLE', r);
  r = await call('POST', '/calls', { token: A.token, body: { userId: A.id } });
  check('calling yourself rejected', r.status === 400, r);

  const t0 = Date.now();
  r = await call('POST', '/calls', { token: A.token, body: { userId: B.id } });
  check('call starts ringing', r.status === 201 && r.data.callId && r.data.peer.name === 'Bela', r);
  callId = r.data.callId;
  const incoming = await waitFor(B, 'call:incoming', { since: t0 });
  check('callee gets call:incoming with caller info', incoming?.callId === callId && incoming.from.name === 'Aman', incoming);
  check('incoming payload hides phone', incoming && !('phone' in incoming.from), incoming);

  r = await call('GET', '/calls/active', { token: B.token });
  check('callee sees the ringing call in /calls/active', r.data.call?.status === 'ringing' && r.data.call.direction === 'incoming', r.data);

  r = await call('POST', '/calls', { token: F.token, body: { userId: B.id } });
  check('someone else calling a ringing listener → busy', r.status === 409 && /another call/.test(r.data.error.message), r);
  r = await call('POST', '/calls', { token: A.token, body: { userId: C.id } });
  check('caller can’t start a second call', r.status === 409 && /already in a call/.test(r.data.error.message), r);
  r = await call('POST', `/calls/${callId}/accept`, { token: A.token });
  check('caller can’t accept their own call', r.status === 404, r);

  const t1 = Date.now();
  r = await call('POST', `/calls/${callId}/accept`, { token: B.token });
  check('callee accepts with voice credentials', r.status === 200 && typeof r.data.voice?.token === 'string' && r.data.voice.channel === `call_${callId}`, r.data);
  const accepted = await waitFor(A, 'call:accepted', { since: t1 });
  check('caller gets call:accepted with own token', accepted?.voice?.token && accepted.voice.uid !== r.data.voice.uid, accepted);
  const balA = await waitFor(A, 'wallet:balance', { since: t1 });
  const earnB = await waitFor(B, 'earnings:balance', { since: t1 });
  check('first minute charged on pickup (50 → 40)', balA?.balance === 40, balA);
  check('listener earns ₹2.00 per minute', earnB?.balancePaise === 200, earnB);

  r = await call('GET', `/calls/${callId}/voice`, { token: A.token });
  check('voice token can be renewed during the call', r.status === 200 && r.data.voice.channel === `call_${callId}` && r.data.voice.uid === accepted.voice.uid, r);
  check('voice tokens are short-lived', r.data.voice.expiresInSec === 600, r.data.voice);
  r = await call('GET', `/calls/${callId}/voice`, { token: F.token });
  check('outsiders can’t get call voice tokens', r.status === 404, r);

  const t2 = Date.now();
  const balA2 = await waitFor(A, 'wallet:balance', { since: t2 + 100, timeout: 4000 });
  check('next minute billed on interval (40 → 30)', balA2?.balance === 30, balA2);

  const t3 = Date.now();
  r = await call('POST', `/calls/${callId}/end`, { token: A.token });
  check('hang up 204', r.status === 204, r);
  const endA = await waitFor(A, 'call:ended', { since: t3 });
  const endB = await waitFor(B, 'call:ended', { since: t3 });
  check('caller told "hangup" with coins spent', endA?.reason === 'hangup' && endA.coins === 20 && endA.durationSec >= 2, endA);
  check('callee told "peer_hangup" with ₹ earned', endB?.reason === 'peer_hangup' && endB.earnedPaise === 400 && endB.coins === 0, endB);
  r = await call('POST', `/calls/${callId}/end`, { token: A.token });
  check('ending twice is harmless', r.status === 204, r);
  r = await call('GET', `/calls/${callId}/voice`, { token: A.token });
  check('no voice token renewal after the call ended', r.status === 404, r);
  await sleep(2500);
  r = await call('GET', '/wallet', { token: A.token });
  check('no billing after hang up', r.data.balance === 30, r.data.balance);
  const charges = r.data.transactions.filter((t: any) => t.type === 'call_charge');
  check('one ledger row for the whole call', charges.length === 1 && charges[0].amount === -20 && /2 min/.test(charges[0].description), r.data.transactions);

  r = await call('GET', '/calls/history', { token: A.token });
  check('caller history', r.data.calls[0]?.direction === 'outgoing' && r.data.calls[0].status === 'completed' && r.data.calls[0].coins === 20, r.data.calls[0]);
  r = await call('GET', '/calls/history', { token: B.token });
  check('callee history', r.data.calls[0]?.direction === 'incoming' && r.data.calls[0].earnedPaise === 400, r.data.calls[0]);
  r = await call('GET', '/calls/active', { token: A.token });
  check('no active call after hang up', r.data.call === null, r.data);
});

test('ratings', async () => {
  let r = await call('POST', `/calls/${callId}/rate`, { token: A.token, body: { stars: 4 } });
  check('rate 204', r.status === 204, r);
  await call('POST', `/calls/${callId}/rate`, { token: A.token, body: { stars: 1 } });
  r = await call('GET', `/users/${B.id}`, { token: A.token });
  check('rating applied once (4.0 from 1 rating)', r.data.user.rating === 4 && r.data.user.ratingCount === 1, r.data.user);
  r = await call('POST', `/calls/${callId}/rate`, { token: A.token, body: { stars: 9 } });
  check('invalid stars rejected', r.status === 400, r);
  r = await call('POST', `/calls/${callId}/rate`, { token: D.token, body: { stars: 5 } });
  check('outsider can’t rate', r.status === 404, r);
  r = await call('GET', '/calls/history', { token: A.token });
  check('history shows my rating', r.data.calls[0].rating === 4, r.data.calls[0]);
});

test('call: decline, cancel, no answer', async () => {
  let r = await call('POST', '/calls', { token: A.token, body: { userId: B.id } });
  let id = r.data.callId;
  await waitFor(B, 'call:incoming', byCall(id));
  await call('POST', `/calls/${id}/reject`, { token: B.token });
  let end = await waitFor(A, 'call:ended', byCall(id));
  check('declined → caller told "rejected"', end?.reason === 'rejected' && end.coins === 0, end);

  r = await call('POST', '/calls', { token: A.token, body: { userId: B.id } });
  id = r.data.callId;
  await waitFor(B, 'call:incoming', byCall(id));
  await call('POST', `/calls/${id}/end`, { token: A.token });
  end = await waitFor(B, 'call:ended', byCall(id));
  check('caller cancels → callee told "cancelled"', end?.reason === 'cancelled', end);

  r = await call('POST', '/calls', { token: A.token, body: { userId: B.id } });
  id = r.data.callId;
  end = await waitFor(A, 'call:ended', { ...byCall(id), timeout: 5000 });
  const endB = await waitFor(B, 'call:ended', { ...byCall(id), timeout: 1000 });
  check('unanswered call times out as "no_answer"', end?.reason === 'no_answer' && endB?.reason === 'no_answer', { end, endB });
  r = await call('POST', `/calls/${id}/accept`, { token: B.token });
  check('accepting after timeout fails', r.status === 404, r);

  r = await call('GET', '/calls/history', { token: B.token });
  const statuses = r.data.calls.slice(0, 3).map((c: any) => c.status);
  check('history statuses', JSON.stringify(statuses) === JSON.stringify(['missed', 'cancelled', 'rejected']), statuses);
  r = await call('GET', '/wallet', { token: A.token });
  check('unanswered calls are free', r.data.balance === 30, r.data.balance);

  // History pages: newest first, then older ones with ?before=
  const first = await call('GET', '/calls/history?limit=2', { token: B.token });
  const next = await call('GET', `/calls/history?limit=2&before=${encodeURIComponent(first.data.calls[1].startedAt)}`, { token: B.token });
  const ids = [...first.data.calls, ...next.data.calls].map((c: any) => c.id);
  check('history pages don’t repeat or skip', first.data.calls.length === 2 && next.data.calls.length === 2 && new Set(ids).size === 4, ids);
  check('older page is older', Date.parse(next.data.calls[0].startedAt) < Date.parse(first.data.calls[1].startedAt), { first: first.data.calls, next: next.data.calls });
});

test('call: caller runs out of coins', async () => {
  const t = Date.now();
  let r = await call('POST', '/calls', { token: A.token, body: { userId: B.id } });
  await waitFor(B, 'call:incoming', { since: t });
  await call('POST', `/calls/${r.data.callId}/accept`, { token: B.token });
  const end = await waitFor(A, 'call:ended', { since: t, timeout: 10_000 });
  check('call ends with "insufficient_balance"', end?.reason === 'insufficient_balance' && end.coins === 30, end);
  r = await call('GET', '/wallet', { token: A.token });
  check('balance exactly 0, never negative', r.data.balance === 0, r.data.balance);
  r = await call('POST', '/calls', { token: A.token, body: { userId: B.id } });
  check('can’t call with 0 coins', r.status === 400 && r.data.error.code === 'INSUFFICIENT_BALANCE', r);
});

test('call: listener disconnects mid-call', async () => {
  await call('POST', '/wallet/recharge', { token: A.token, body: { packId: 'pack_100' } });
  const t = Date.now();
  let r = await call('POST', '/calls', { token: A.token, body: { userId: B.id } });
  await waitFor(B, 'call:incoming', { since: t });
  await call('POST', `/calls/${r.data.callId}/accept`, { token: B.token });
  B.socket!.disconnect();
  const end = await waitFor(A, 'call:ended', { since: t, timeout: 4000 });
  check('call ends as "peer_hangup" after grace period', end?.reason === 'peer_hangup', end);
  r = await call('GET', `/users/${B.id}`, { token: A.token });
  check('disconnected user marked offline', r.data.user.isOnline === false, r.data.user);
  await connect(B);
  await sleep(150);
});

test('random match', async () => {
  let r = await call('POST', '/calls/match', { token: A.token, body: { language: 'English' } });
  check('match prefers language (only Bela speaks English)', r.data.user?.id === B.id, r.data);
  await call('PATCH', '/users/me', { token: B.token, body: { isAvailable: false } });
  r = await call('POST', '/calls/match', { token: A.token, body: { language: 'English' } });
  check('falls back to any free listener', r.data.user?.id === C.id, r.data);
  r = await call('POST', '/calls', { token: A.token, body: { userId: B.id } });
  check('unavailable listener can’t be called', r.status === 409, r);
  await call('PATCH', '/users/me', { token: C.token, body: { isAvailable: false } });
  r = await call('POST', '/calls/match', { token: A.token, body: {} });
  check('no free listener → NO_MATCH', r.status === 404 && r.data.error.code === 'NO_MATCH', r);
  await call('PATCH', '/users/me', { token: B.token, body: { isAvailable: true } });
  await call('PATCH', '/users/me', { token: C.token, body: { isAvailable: true } });
});

test('voice rooms', async () => {
  let r = await call('POST', '/rooms', { token: A.token, body: { title: 'Career chat', topic: 'Career', language: 'Hindi' } });
  check('users can’t host rooms', r.status === 403, r);
  r = await call('POST', '/rooms', { token: B.token, body: { title: 'Hi', topic: 'Career', language: 'Hindi' } });
  check('short room title rejected', r.status === 400, r);
  r = await call('POST', '/rooms', { token: B.token, body: { title: 'Career chat', topic: 'Career', language: 'Hindi' } });
  check('listener host creates room with speaking token', r.status === 201 && r.data.voice?.token && r.data.room.participants[0].role === 'host', r.data);
  const roomId = r.data.room.id;

  r = await call('GET', '/rooms', { token: A.token });
  check('room listed', r.data.rooms.some((x: any) => x.id === roomId), r.data);

  let t = Date.now();
  r = await call('POST', `/rooms/${roomId}/join`, { token: A.token });
  check('user joins with voice credentials', r.status === 200 && r.data.voice?.channel === `room_${roomId}`, r.data);
  const joinedVoice = r.data.voice;
  let upd = await waitFor(B, 'room:updated', { since: t, where: (p) => p.room.participants.length === 2 });
  check('host sees the new listener live', upd?.room.participants.some((p: any) => p.user.id === A.id && p.role === 'listener'), upd);
  const aTile = upd?.room.participants.find((p: any) => p.user.id === A.id);
  check('participants carry their voice uid (to show who is talking)', aTile?.voiceUid === joinedVoice.uid, { aTile, joinedVoice });
  r = await call('GET', `/rooms/${roomId}/voice`, { token: A.token });
  check('room voice token can be renewed', r.status === 200 && r.data.voice.channel === `room_${roomId}`, r);
  check('audience tokens are listen-only', joinedVoice.canSpeak === false && r.data.voice.canSpeak === false, { joinedVoice, renewed: r.data.voice });
  r = await call('GET', `/rooms/${roomId}/voice`, { token: F.token });
  check('only people in the room get its voice token', r.status === 400, r);

  r = await call('POST', `/rooms/${roomId}/mute`, { token: A.token, body: { muted: false } });
  check('audience can’t unmute', r.status === 400, r);

  t = Date.now();
  await call('POST', `/rooms/${roomId}/hand`, { token: A.token, body: { raised: true } });
  upd = await waitFor(B, 'room:updated', { since: t, where: (p) => p.room.participants.some((x: any) => x.handRaised) });
  check('raised hand broadcast', !!upd, upd);

  r = await call('PUT', `/rooms/${roomId}/participants/${B.id}/role`, { token: A.token, body: { role: 'listener' } });
  check('non-host can’t change roles', r.status === 403, r);

  t = Date.now();
  await call('PUT', `/rooms/${roomId}/participants/${A.id}/role`, { token: B.token, body: { role: 'speaker' } });
  const voice = await waitFor(A, 'room:voice', { since: t });
  check('new speaker gets fresh voice token', voice?.roomId === roomId && voice.voice?.token && voice.voice.canSpeak === true, voice);
  upd = await waitFor(A, 'room:updated', { since: t, where: (p) => p.room.participants.some((x: any) => x.user.id === A.id && x.role === 'speaker') });
  const ap = upd?.room.participants.find((x: any) => x.user.id === A.id);
  check('speaker starts muted, hand lowered', ap?.isMuted === true && ap.handRaised === false, ap);

  t = Date.now();
  await call('POST', `/rooms/${roomId}/mute`, { token: A.token, body: { muted: false } });
  upd = await waitFor(B, 'room:updated', { since: t, where: (p) => p.room.participants.some((x: any) => x.user.id === A.id && !x.isMuted) });
  check('speaker unmutes', !!upd, upd);

  await call('POST', `/rooms/${roomId}/join`, { token: C.token });
  t = Date.now();
  r = await call('DELETE', `/rooms/${roomId}/participants/${C.id}`, { token: B.token });
  const removed = await waitFor(C, 'room:removed', { since: t });
  check('host removes someone', r.status === 204 && removed?.roomId === roomId, { r, removed });
  r = await call('POST', `/rooms/${roomId}/join`, { token: C.token });
  check('removed person can’t rejoin', r.status === 403, r);

  // Starting your own room leaves the current one
  await call('POST', `/rooms/${roomId}/join`, { token: D.token });
  t = Date.now();
  r = await call('POST', '/rooms', { token: D.token, body: { title: 'Dev’s room', topic: 'Music', language: 'Hindi' } });
  upd = await waitFor(B, 'room:updated', { since: t, where: (p) => !p.room.participants.some((x: any) => x.user.id === D.id) });
  check('starting your own room leaves the previous one', !!upd, upd);
  await call('POST', `/rooms/${r.data.room.id}/leave`, { token: D.token });

  await call('POST', `/rooms/${roomId}/leave`, { token: B.token });
  r = await call('GET', '/rooms', { token: C.token });
  check('host leaving ends the room', !r.data.rooms.some((x: any) => x.id === roomId), r.data);
  r = await call('POST', `/rooms/${roomId}/join`, { token: A.token });
  check('ended room can’t be joined', r.status === 404, r);

  // Host disconnects → room closes for everyone
  r = await call('POST', '/rooms', { token: C.token, body: { title: 'Charu’s room', topic: 'Music', language: 'Tamil' } });
  const roomC = r.data.room.id;
  await call('POST', `/rooms/${roomC}/join`, { token: A.token });
  t = Date.now();
  C.socket!.disconnect();
  const closed = await waitFor(A, 'room:closed', { since: t, timeout: 4000 });
  check('host going offline closes the room', closed?.roomId === roomC, closed);
});

test('blocking applies to calls and rooms', async () => {
  await connect(C);
  await sleep(150);
  await call('PUT', `/users/${B.id}/block`, { token: A.token });
  let r = await call('POST', '/calls', { token: A.token, body: { userId: B.id } });
  check('can’t call someone you blocked', r.status === 403 && r.data.error.code === 'BLOCKED', r);
  r = await call('POST', '/rooms', { token: B.token, body: { title: 'Private-ish', topic: 'Music', language: 'Hindi' } });
  const rid = r.data.room.id;
  r = await call('GET', '/rooms', { token: A.token });
  check('blocked host’s room is hidden', !r.data.rooms.some((x: any) => x.id === rid), r.data);
  r = await call('POST', `/rooms/${rid}/join`, { token: A.token });
  check('can’t join a blocked host’s room', r.status === 404, r);
  await call('DELETE', `/users/${B.id}/block`, { token: A.token });
});

test('one voice session at a time', async () => {
  // B hosts a room that F listens to; A calls B
  let r = await call('POST', '/rooms', { token: B.token, body: { title: 'Evening chat', topic: 'Music', language: 'Hindi' } });
  const roomId = r.data.room.id;
  await call('POST', `/rooms/${roomId}/join`, { token: F.token });

  const t = Date.now();
  r = await call('POST', '/calls', { token: A.token, body: { userId: B.id } });
  const id = r.data.callId;
  await waitFor(B, 'call:incoming', byCall(id));
  r = await call('POST', '/rooms', { token: B.token, body: { title: 'Another room', topic: 'Music', language: 'Hindi' } });
  check('a listener can’t start a room while their phone rings', r.status === 409, r);
  r = await call('POST', `/rooms/${roomId}/join`, { token: A.token });
  check('can’t join a room while in a call', r.status === 409 && /Finish your call/.test(r.data.error.message), r);

  await call('POST', `/calls/${id}/accept`, { token: B.token });
  const closed = await waitFor(F, 'room:closed', { since: t });
  check('accepting a call takes the host out of their room (room ends)', closed?.roomId === roomId, closed);
  await call('POST', `/calls/${id}/end`, { token: A.token });
});

test('several people calling the same listener at once', async () => {
  const admin = await makeUser('9810000019', 'Admin2');
  await makeAdmin(admin);
  const L = await makeListener('9810000011', 'Lata', admin);
  const callers = await Promise.all(['9810000021', '9810000022', '9810000023', '9810000024', '9810000025'].map((p, i) => makeUser(p, `Caller${i}`)));
  await Promise.all([connect(L), ...callers.map((c) => connect(c))]);
  await sleep(200);

  // Five calls at the same instant
  const t = Date.now();
  const results = await Promise.all(callers.map((c) => call('POST', '/calls', { token: c.token, body: { userId: L.id } })));
  const won = results.filter((r) => r.status === 201);
  const busy = results.filter((r) => r.status === 409 && /on another call/.test(r.data.error.message));
  check('exactly one call gets through', won.length === 1, results.map((r) => r.status));
  check('the other four are told the listener is on another call', busy.length === 4, results.map((r) => r.data));
  await sleep(300);
  check('the listener’s phone rings only once', L.events.filter((e) => e.event === 'call:incoming' && e.at >= t).length === 1);

  // While ringing, and then while talking, everyone else stays blocked
  const winner = callers[results.findIndex((r) => r.status === 201)];
  const others = callers.filter((c) => c !== winner);
  let r = await call('GET', `/users/${L.id}`, { token: others[0].token });
  check('others see the listener as busy', r.data.user.isBusy === true, r.data.user);
  await call('POST', `/calls/${won[0].data.callId}/accept`, { token: L.token });
  r = await call('POST', '/calls', { token: others[0].token, body: { userId: L.id } });
  check('calling during an active call → busy', r.status === 409, r);
  r = await call('POST', '/calls/match', { token: others[1].token, body: {} });
  check('random match skips the busy listener', r.status === 404 || r.data.user?.id !== L.id, r);
  r = await call('GET', '/users', { token: others[0].token });
  const listed = r.data.users.find((u: any) => u.id === L.id);
  check('the listeners list marks them busy', listed?.isBusy === true, listed);

  // Once the call ends, the next person gets through
  await call('POST', `/calls/${won[0].data.callId}/end`, { token: winner.token });
  await sleep(100);
  r = await call('GET', `/users/${L.id}`, { token: others[0].token });
  check('no longer busy after hanging up', r.data.user.isBusy === false, r.data.user);
  r = await call('POST', '/calls', { token: others[0].token, body: { userId: L.id } });
  check('the next caller gets through', r.status === 201, r);
  await call('POST', `/calls/${r.data.callId}/end`, { token: others[0].token });
});
