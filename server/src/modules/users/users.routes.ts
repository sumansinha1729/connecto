import { Router } from 'express';
import { z } from 'zod';

import { GENDERS, INTERESTS, LANGUAGES, MAX_INTERESTS, MAX_LANGUAGES, MIN_AGE, REPORT_REASONS } from '../../config/options';
import { currentUser, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { AVATAR_PATTERN } from '../../utils/avatar';
import { idParams } from '../../utils/validators';
import { toMe } from './user.serializer';
import {
  applyAsListener,
  deleteAccount,
  getUserProfile,
  listBlocked,
  listFavorites,
  listUsers,
  reportUser,
  setBlocked,
  setFavorite,
  updateProfile,
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
    role: z.enum(['user', 'listener']),
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
  await deleteAccount(currentUser(req));
  res.status(204).end();
});

usersRouter.post(
  '/me/listener-application',
  validate({
    body: z.object({
      about: z.string().trim().min(20, 'Tell us a bit more (at least 20 characters).').max(500),
    }),
  }),
  async (req, res) => {
    const user = await applyAsListener(currentUser(req), req.body.about);
    res.json({ user: toMe(user) });
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
  res.json({ user: await getUserProfile(currentUser(req), req.params.id as string) });
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
