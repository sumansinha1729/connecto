import express, { Router } from 'express';
import { z } from 'zod';

import { GENDERS, INTERESTS, LANGUAGES, MAX_INTERESTS, MAX_LANGUAGES, MIN_AGE, REPORT_REASONS } from '../../config/options';
import { currentUser, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { disconnectUser } from '../../realtime/io';
import { ApiError } from '../../utils/ApiError';
import { AVATAR_PATTERN } from '../../utils/avatar';
import { idParams } from '../../utils/validators';
import { endCallsOfOfflineUser } from '../calls/calls.service';
import { leaveAllRooms } from '../rooms/rooms.service';
import { toMe } from './user.serializer';
import {
  deleteAccount,
  getUserProfile,
  listBlocked,
  listFavorites,
  listUsers,
  reportUser,
  setBlocked,
  setFavorite,
  setSignupIntent,
  submitListenerApplication,
  updateProfile,
  uploadVoiceIntro,
  type UserFilters,
} from './users.service';

export const usersRouter = Router();
usersRouter.use(requireAuth);

const unique = <T extends z.ZodType>(item: T, max: number, label: string) =>
  z
    .array(item)
    .max(max, `Pick up to ${max} ${label}.`)
    .refine((list) => new Set(list).size === list.length, `Duplicate ${label}.`);

const profileUpdate = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(20),
    gender: z.enum(GENDERS),
    age: z.number().int().min(MIN_AGE, `You must be ${MIN_AGE} or older.`).max(99),
    bio: z.string().trim().max(120),
    languages: unique(z.enum(LANGUAGES), MAX_LANGUAGES, 'languages'),
    interests: unique(z.enum(INTERESTS), MAX_INTERESTS, 'interests'),
    avatar: z.string().regex(AVATAR_PATTERN, 'Invalid avatar.'),
    isAvailable: z.boolean(),
  })
  .partial()
  .strict();

const booleanQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

const listQuery = z.object({
  listenersOnly: booleanQuery,
  onlineOnly: booleanQuery,
  language: z.enum(LANGUAGES).optional(),
  gender: z.enum(GENDERS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

// ---------- Me ----------

usersRouter.get('/me', (req, res) => {
  res.json({ user: toMe(currentUser(req)) });
});

usersRouter.patch('/me', validate({ body: profileUpdate }), async (req, res) => {
  const user = await updateProfile(currentUser(req), req.body);
  res.json({ user: toMe(user) });
});

usersRouter.delete('/me', async (req, res) => {
  const me = currentUser(req);
  await deleteAccount(me);
  // Like a ban: end any call (and its billing), leave rooms, close the app's live connection
  disconnectUser(me.id);
  await endCallsOfOfflineUser(me.id);
  await leaveAllRooms(me.id);
  res.status(204).end();
});

/** First screen after signup: "I want to talk" (user) or "I want to be a listener" */
usersRouter.post('/me/intent', validate({ body: z.object({ intent: z.enum(['user', 'listener']) }) }), async (req, res) => {
  res.json({ user: toMe(await setSignupIntent(currentUser(req), req.body.intent)) });
});

/** Listener voice intro: raw audio body, length in the X-Duration-Sec header */
usersRouter.put('/me/voice-intro', express.raw({ type: 'audio/*', limit: '5mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body)) throw ApiError.badRequest('Send the recording as audio.');
  const user = await uploadVoiceIntro(
    currentUser(req),
    req.body,
    req.get('content-type') ?? '',
    Number(req.get('x-duration-sec')),
  );
  res.json({ user: toMe(user) });
});

usersRouter.post(
  '/me/listener-application',
  validate({
    body: z.object({
      fullName: z.string().trim().min(3, 'Enter your full name.').max(80),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter your date of birth as YYYY-MM-DD.'),
      city: z.string().trim().min(2, 'Enter your city.').max(60),
      about: z.string().trim().min(20, 'Tell us a bit more (at least 20 characters).').max(500),
    }),
  }),
  async (req, res) => {
    res.json({ user: toMe(await submitListenerApplication(currentUser(req), req.body)) });
  },
);

usersRouter.get('/me/favorites', async (req, res) => {
  res.json({ users: await listFavorites(currentUser(req)) });
});

usersRouter.get('/me/blocked', async (req, res) => {
  res.json({ users: await listBlocked(currentUser(req)) });
});

// ---------- Others ----------

usersRouter.get('/', validate({ query: listQuery }), async (req, res) => {
  res.json({ users: await listUsers(currentUser(req), res.locals.query as UserFilters) });
});

usersRouter.get('/:id', validate({ params: idParams }), async (req, res) => {
  res.json(await getUserProfile(currentUser(req), req.params.id as string));
});

usersRouter.put('/:id/favorite', validate({ params: idParams }), async (req, res) => {
  await setFavorite(currentUser(req), req.params.id as string, true);
  res.status(204).end();
});

usersRouter.delete('/:id/favorite', validate({ params: idParams }), async (req, res) => {
  await setFavorite(currentUser(req), req.params.id as string, false);
  res.status(204).end();
});

usersRouter.put('/:id/block', validate({ params: idParams }), async (req, res) => {
  await setBlocked(currentUser(req), req.params.id as string, true);
  res.status(204).end();
});

usersRouter.delete('/:id/block', validate({ params: idParams }), async (req, res) => {
  await setBlocked(currentUser(req), req.params.id as string, false);
  res.status(204).end();
});

usersRouter.post(
  '/:id/report',
  validate({
    params: idParams,
    body: z.object({ reason: z.enum(REPORT_REASONS), details: z.string().max(500).default('') }),
  }),
  async (req, res) => {
    await reportUser(currentUser(req), req.params.id as string, req.body.reason, req.body.details);
    res.status(204).end();
  },
);
