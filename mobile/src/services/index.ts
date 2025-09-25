/**
 * Single switch point between the mock backend and the real one.
 * When the server is ready, add an `http/` implementation of the same
 * contracts and export it here instead.
 */
import type { Api } from './contracts';
import { mockAuth } from './mock/auth';
import { mockCalls } from './mock/calls';
import { mockRooms } from './mock/rooms';
import { mockUsers } from './mock/users';
import { mockWallet } from './mock/wallet';

export const api: Api = {
  auth: mockAuth,
  users: mockUsers,
  wallet: mockWallet,
  calls: mockCalls,
  rooms: mockRooms,
};

export { realtime } from './realtime';
export { session } from './session';
