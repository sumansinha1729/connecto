import { Router } from 'express';
import { z } from 'zod';

import { LANGUAGES, ROOM_TOPICS } from '../../config/options';
import { currentUser, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParams, objectId } from '../../utils/validators';
import {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  listRooms,
  removeParticipant,
  setHandRaised,
  setMuted,
  setRole,
} from './rooms.service';

export const roomsRouter = Router();
roomsRouter.use(requireAuth);

const participantParams = z.object({ id: objectId, userId: objectId });

roomsRouter.get('/', async (req, res) => {
  res.json({ rooms: await listRooms(currentUser(req)) });
});

roomsRouter.post(
  '/',
  validate({
    body: z.object({
      title: z.string().trim().min(3, 'Give your room a title (at least 3 characters).').max(60),
      topic: z.enum(ROOM_TOPICS),
      language: z.enum(LANGUAGES),
    }),
  }),
  async (req, res) => {
    res.status(201).json(await createRoom(currentUser(req), req.body));
  },
);

roomsRouter.get('/:id', validate({ params: idParams }), async (req, res) => {
  res.json({ room: await getRoom(currentUser(req), req.params.id as string) });
});

roomsRouter.post('/:id/join', validate({ params: idParams }), async (req, res) => {
  res.json(await joinRoom(currentUser(req), req.params.id as string));
});

roomsRouter.post('/:id/leave', validate({ params: idParams }), async (req, res) => {
  await leaveRoom(currentUser(req), req.params.id as string);
  res.status(204).end();
});

roomsRouter.post(
  '/:id/hand',
  validate({ params: idParams, body: z.object({ raised: z.boolean() }) }),
  async (req, res) => {
    await setHandRaised(currentUser(req), req.params.id as string, req.body.raised);
    res.status(204).end();
  },
);

roomsRouter.post(
  '/:id/mute',
  validate({ params: idParams, body: z.object({ muted: z.boolean() }) }),
  async (req, res) => {
    await setMuted(currentUser(req), req.params.id as string, req.body.muted);
    res.status(204).end();
  },
);

roomsRouter.put(
  '/:id/participants/:userId/role',
  validate({ params: participantParams, body: z.object({ role: z.enum(['speaker', 'listener']) }) }),
  async (req, res) => {
    await setRole(currentUser(req), req.params.id as string, req.params.userId as string, req.body.role);
    res.status(204).end();
  },
);

roomsRouter.delete('/:id/participants/:userId', validate({ params: participantParams }), async (req, res) => {
  await removeParticipant(currentUser(req), req.params.id as string, req.params.userId as string);
  res.status(204).end();
});
