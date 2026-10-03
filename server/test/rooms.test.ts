// Rooms: welcome message, chat, reactions, co-hosts (incl. taking over), muting speakers, stage limit
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

before(() => startTestServer('rooms'));
after(stopTestServer);

let H: TestUser; // host (listener)
let C: TestUser; // listener who becomes co-host
let U1: TestUser;
let U2: TestUser;
let roomId: string;

test('room info: welcome message, editing, host first', async () => {
  const admin = await makeUser('9860000009', 'Admin');
  await makeAdmin(admin);
  H = await makeListener('9860000001', 'Hema', admin);
  C = await makeListener('9860000002', 'Chetan', admin);
  U1 = await makeUser('9860000003', 'Uma');
  U2 = await makeUser('9860000004', 'Usman');
  await Promise.all([connect(H), connect(C), connect(U1), connect(U2)]);
  await sleep(150);

  let r = await call('POST', '/rooms', {
    token: H.token,
    body: { title: 'Late night talks', topic: 'Late night talks', language: 'Hindi', description: 'Be kind. One person at a time.' },
  });
  check('room created with a welcome message', r.status === 201 && r.data.room.description === 'Be kind. One person at a time.' && Array.isArray(r.data.messages), r.data);
  roomId = r.data.room.id;

  r = await call('POST', '/rooms', { token: C.token, body: { title: 'Too long', topic: 'Music', language: 'Hindi', description: 'x'.repeat(201) } });
  check('welcome message limited to 200 characters', r.status === 400, r);

  await call('POST', `/rooms/${roomId}/join`, { token: U1.token });
  r = await call('PATCH', `/rooms/${roomId}`, { token: U1.token, body: { description: 'hacked' } });
  check('the audience can’t edit the room', r.status === 403, r);
  const t = Date.now();
  r = await call('PATCH', `/rooms/${roomId}`, { token: H.token, body: { description: 'Be kind. No personal numbers.' } });
  const upd = await waitFor(U1, 'room:updated', { since: t, where: (p) => p.room.description === 'Be kind. No personal numbers.' });
  check('host edits the welcome message, everyone sees it', r.status === 204 && !!upd, upd);
  check('host listed first', upd?.room.participants[0].role === 'host', upd?.room.participants);
});

test('chat: messages, history, hidden numbers, limits, deleting', async () => {
  let t = Date.now();
  await call('POST', `/rooms/${roomId}/join`, { token: U2.token });
  const joined = await waitFor(H, 'room:message', { since: t, where: (p) => p.message.kind === 'join' });
  check('"Usman joined" shows in the chat', joined?.message.user.name === 'Usman', joined);

  t = Date.now();
  let r = await call('POST', `/rooms/${roomId}/messages`, { token: U1.token, body: { text: 'Hello everyone 👋' } });
  check('send a message', r.status === 201 && r.data.message.text === 'Hello everyone 👋', r);
  const firstId = r.data.message.id;
  const got = await waitFor(H, 'room:message', { since: t, where: (p) => p.message.kind === 'chat' });
  check('everyone receives it live', got?.message.text === 'Hello everyone 👋' && got.message.user.name === 'Uma', got);

  r = await call('POST', `/rooms/${roomId}/messages`, { token: U1.token, body: { text: 'again' } });
  check('sending too fast is refused', r.status === 429, r);
  await sleep(1100);
  r = await call('POST', `/rooms/${roomId}/messages`, { token: U1.token, body: { text: 'call me on 98765 43210 or wa.me 9876543210, see https://spam.example' } });
  check('phone numbers and links are hidden', r.status === 201 && !/\d{5}/.test(r.data.message.text) && /\[number hidden\]/.test(r.data.message.text) && /\[link removed\]/.test(r.data.message.text), r.data);
  r = await call('POST', `/rooms/${roomId}/messages`, { token: U2.token, body: { text: '   ' } });
  check('empty message refused', r.status === 400, r);
  r = await call('POST', `/rooms/${roomId}/messages`, { token: C.token, body: { text: 'not in the room' } });
  check('only people in the room can chat', r.status === 400, r);

  r = await call('DELETE', `/rooms/${roomId}/messages/${firstId}`, { token: U2.token });
  check('can’t delete someone else’s message', r.status === 403, r);
  t = Date.now();
  r = await call('DELETE', `/rooms/${roomId}/messages/${firstId}`, { token: H.token });
  const deleted = await waitFor(U1, 'room:message-deleted', { since: t });
  check('host deletes a message, it disappears for everyone', r.status === 204 && deleted?.messageId === firstId, deleted);

  r = await call('POST', `/rooms/${roomId}/join`, { token: C.token });
  const history = r.data.messages;
  const chats = history.filter((m: any) => m.kind === 'chat');
  check('people who join late see the recent chat', chats.length === 1 && chats[0].user.name === 'Uma', history);
  check('…including who joined before them', history.some((m: any) => m.kind === 'join' && m.user.name === 'Usman'), history);
  check('the person joining sees their own "joined" line', history.at(-1)?.kind === 'join' && history.at(-1).user.name === 'Chetan', history.at(-1));
});

test('reactions', async () => {
  const t = Date.now();
  let r = await call('POST', `/rooms/${roomId}/reactions`, { token: U2.token, body: { emoji: '❤️' } });
  const got = await waitFor(H, 'room:reaction', { since: t });
  check('reaction broadcast to the room', r.status === 204 && got?.emoji === '❤️' && got.userId === U2.id, got);
  r = await call('POST', `/rooms/${roomId}/reactions`, { token: U2.token, body: { emoji: '❤️' } });
  check('reacting too fast is refused', r.status === 429, r);
  r = await call('POST', `/rooms/${roomId}/reactions`, { token: U2.token, body: { emoji: '💩' } });
  check('unknown emoji refused', r.status === 400, r);
});

test('co-hosts: who can do what, muting speakers', async () => {
  let r = await call('PUT', `/rooms/${roomId}/participants/${U1.id}/role`, { token: H.token, body: { role: 'cohost' } });
  check('normal users can’t be co-hosts (only listeners host rooms)', r.status === 403 && /Only listeners/.test(r.data.error.message), r);

  let t = Date.now();
  r = await call('PUT', `/rooms/${roomId}/participants/${C.id}/role`, { token: H.token, body: { role: 'cohost' } });
  check('host makes a listener co-host', r.status === 204, r);
  const voice = await waitFor(C, 'room:voice', { since: t });
  check('co-host can talk (gets a speaking token)', voice?.voice?.canSpeak === true, voice);
  const note = await waitFor(U1, 'room:message', { since: t, where: (p) => p.message.kind === 'system' });
  check('"Chetan is now a co-host" shows in the chat', /co-host/.test(note?.message.text ?? ''), note);

  r = await call('PUT', `/rooms/${roomId}/participants/${U1.id}/role`, { token: C.token, body: { role: 'speaker' } });
  check('co-host invites someone to speak', r.status === 204, r);
  r = await call('PUT', `/rooms/${roomId}/participants/${U2.id}/role`, { token: U1.token, body: { role: 'speaker' } });
  check('speakers can’t invite others', r.status === 403, r);
  r = await call('PUT', `/rooms/${roomId}/participants/${U2.id}/role`, { token: C.token, body: { role: 'cohost' } });
  check('co-hosts can’t make co-hosts', r.status === 403, r);

  await call('POST', `/rooms/${roomId}/mute`, { token: U1.token, body: { muted: false } });
  t = Date.now();
  r = await call('POST', `/rooms/${roomId}/participants/${U1.id}/mute`, { token: C.token });
  const muted = await waitFor(U1, 'room:muted', { since: t });
  const upd = await waitFor(U1, 'room:updated', { since: t, where: (p) => p.room.participants.some((x: any) => x.user.id === U1.id && x.isMuted) });
  check('co-host mutes a speaker, who is told who did it', r.status === 204 && muted?.by === 'Chetan' && !!upd, { muted, upd });
  r = await call('POST', `/rooms/${roomId}/participants/${H.id}/mute`, { token: C.token });
  check('co-host can’t mute the host', r.status === 403, r);
  r = await call('POST', `/rooms/${roomId}/participants/${U2.id}/mute`, { token: C.token });
  check('nothing to mute in the audience', r.status === 400, r);
  r = await call('DELETE', `/rooms/${roomId}/participants/${H.id}`, { token: C.token });
  check('co-host can’t remove the host', r.status === 403, r);
});

test('stage limit', async () => {
  // On stage now: host, co-host, Uma = 3. Fill it up to 10.
  const extra: TestUser[] = [];
  for (let i = 0; i < 8; i++) {
    const u = await makeUser(`98600001${String(i).padStart(2, '0')}`, `Guest${i}`);
    await call('POST', `/rooms/${roomId}/join`, { token: u.token });
    extra.push(u);
  }
  for (const u of extra.slice(0, 7)) await call('PUT', `/rooms/${roomId}/participants/${u.id}/role`, { token: H.token, body: { role: 'speaker' } });
  const r = await call('PUT', `/rooms/${roomId}/participants/${extra[7].id}/role`, { token: H.token, body: { role: 'speaker' } });
  check('11th person can’t join the stage', r.status === 409 && /stage is full/.test(r.data.error.message), r);
});

test('host leaves: the co-host takes over; then the room ends', async () => {
  let t = Date.now();
  await call('POST', `/rooms/${roomId}/leave`, { token: H.token });
  const upd = await waitFor(U1, 'room:updated', { since: t, where: (p) => p.room.hostId === C.id });
  check('co-host becomes the host', !!upd && upd.room.participants[0].user.id === C.id && upd.room.participants[0].role === 'host', upd?.room.participants.slice(0, 2));
  check('old host is gone', !upd?.room.participants.some((p: any) => p.user.id === H.id));
  const note = await waitFor(U1, 'room:message', { since: t, where: (p) => /now the host/.test(p.message.text) });
  check('"Chetan is now the host" shows in the chat', !!note, note);
  let r = await call('GET', '/rooms', { token: U2.token });
  check('room is still live', r.data.rooms.some((x: any) => x.id === roomId), r.data.rooms);

  t = Date.now();
  await call('POST', `/rooms/${roomId}/leave`, { token: C.token });
  const closed = await waitFor(U1, 'room:closed', { since: t });
  check('no co-host left: the room ends', closed?.roomId === roomId, closed);
});
