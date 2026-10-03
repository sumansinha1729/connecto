// What happens after a crash or redeploy: open calls are closed, live rooms ended, nobody stays "online"
import { call, check, connect, makeAdmin, makeListener, makeUser, sleep, startTestServer, stopTestServer, waitFor } from './helpers';

import { after, before, test } from 'node:test';

import { Call } from '../src/modules/calls/call.model';
import { recoverCallsOnStartup, shutdownCalls } from '../src/modules/calls/calls.service';
import { Room } from '../src/modules/rooms/room.model';
import { endRoomsOnStartup } from '../src/modules/rooms/rooms.service';
import { User } from '../src/modules/users/user.model';
import { resetPresence } from '../src/realtime/presence';

before(() => startTestServer('recovery'));
after(stopTestServer);

test('a restart closes open calls and rooms without extra charges', async () => {
  const admin = await makeUser('9820000009', 'Admin');
  await makeAdmin(admin);
  const U = await makeUser('9820000001', 'Uma');
  const L = await makeListener('9820000002', 'Lata', admin);
  const L2 = await makeListener('9820000003', 'Leela', admin);
  await Promise.all([connect(U), connect(L), connect(L2)]);
  await sleep(150);

  // An answered call and a live room
  const t = Date.now();
  let r = await call('POST', '/calls', { token: U.token, body: { userId: L.id } });
  const answeredId = r.data.callId;
  await waitFor(L, 'call:incoming', { since: t });
  await call('POST', `/calls/${answeredId}/accept`, { token: L.token });
  check('first minute charged', (await waitFor(U, 'wallet:balance', { since: t }))?.balance === 40);
  r = await call('POST', '/rooms', { token: L2.token, body: { title: 'Night owls', topic: 'Music', language: 'Hindi' } });
  const roomId = r.data.room.id;

  // "Crash": timers stop without ending anything. Then run what a fresh server does on boot.
  await shutdownCalls();
  await resetPresence();
  await recoverCallsOnStartup();
  await endRoomsOnStartup();

  const answered = await Call.findById(answeredId).lean();
  check('answered call closed as completed', answered?.status === 'completed' && answered.endReason === 'server_restart' && answered.endedAt, answered);
  check('nobody is left locked in a call', (await User.countDocuments({ activeCallId: { $ne: null } })) === 0);
  check('nobody is left "online"', (await User.countDocuments({ isOnline: true })) === 0);
  const room = await Room.findById(roomId).lean();
  check('live room ended', room?.status !== 'live', room);

  await sleep(2500);
  r = await call('GET', '/wallet', { token: U.token });
  check('no billing continues after the restart', r.data.balance === 40, r.data.balance);
});
