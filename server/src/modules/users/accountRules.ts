import { ApiError } from '../../utils/ApiError';
import type { UserDoc } from './user.model';

/*
 * Who may do what. One account is either a user or a listener:
 * - users buy coins and call listeners
 * - listeners only receive calls, earn ₹ and host rooms
 * - someone who chose "listener" at signup can't do either until approved
 *   (or until they decide to continue as a normal user)
 */

export const isListener = (user: UserDoc) => user.role === 'listener' && user.listenerStatus === 'approved';

/** A normal user account (not a listener and not a listener applicant from signup) */
export const actsAsUser = (user: UserDoc) => user.role === 'user' && user.signupIntent === 'user';

export function assertActsAsUser(user: UserDoc, action = 'do that') {
  if (isListener(user)) throw ApiError.forbidden(`Listeners can’t ${action}.`);
  if (!actsAsUser(user)) throw ApiError.forbidden('Your listener application is still being reviewed.');
}

export function assertListener(user: UserDoc, action = 'do that') {
  if (!isListener(user)) throw ApiError.forbidden(`Only approved listeners can ${action}.`);
}
