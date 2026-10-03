import { Router } from 'express';
import { z } from 'zod';

import { LANGUAGES, ROOM_TOPICS } from '../../config/options';
import { currentUser, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParams, objectId } from '../../utils/validators';
import {
  createRoom,
  deleteMessage,
  getRoom,
  getRoomVoice,
  joinRoom,
  leaveRoom,
  listRooms,
  muteParticipant,
  react,
  REACTIONS,
  removeParticipant,
  sendMessage,
  setHandRaised,
  setMuted,
  setRole,
  updateRoom,
} from './rooms.service';

export const roomsRouter = Router();
roomsRouter.use(requireAuth);

const participantParams = z.object({ id: objectId, userId: objectId });
const title = z.string().trim().min(3, 'Give your room a title (at least 3 characters).').max(60);
const description = z.string().trim().max(200, 'Keep the welcome message under 200 characters.');

roomsRouter.get('/', async (req, res) => {
  res.json({ rooms: await listRooms(currentUser(req)) });
});

roomsRouter.post(
  '/',
  validate({
    body: z.object({
      title,
      topic: z.enum(ROOM_TOPICS),
      language: z.enum(LANGUAGES),
      description: description.optional(),
    }),
  }),
  async (req, res) => {
    res.status(201).json(await createRoom(currentUser(req), req.body));
  },
);

/** Host or co-host: edit the title or the welcome message / rules */
roomsRouter.patch(
  '/:id',
  validate({
    params: idParams,
    body: z
      .object({ title: title.optional(), description: description.optional() })
      .refine((b) => b.title !== undefined || b.description !== undefined, 'Nothing to change.'),
  }),
  async (req, res) => {
    await updateRoom(currentUser(req), req.params.id as string, req.body);
    res.status(204).end();
  },
);

roomsRouter.get('/:id', validate({ params: idParams }), async (req, res) => {
  res.json({ room: await getRoom(currentUser(req), req.params.id as string) });
});

/** Renewed voice credentials for your current role in the room */
roomsRouter.get('/:id/voice', validate({ params: idParams }), async (req, res) => {
  res.json({ voice: await getRoomVoice(currentUser(req), req.params.id as string) });
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
  validate({ params: participantParams, body: z.object({ role: z.enum(['cohost', 'speaker', 'listener']) }) }),
  async (req, res) => {
    await setRole(currentUser(req), req.params.id as string, req.params.userId as string, req.body.role);
    res.status(204).end();
  },
);

/** Host or co-host: mute someone on stage */
roomsRouter.post('/:id/participants/:userId/mute', validate({ params: participantParams }), async (req, res) => {
  await muteParticipant(currentUser(req), req.params.id as string, req.params.userId as string);
  res.status(204).end();
});

// ---------- Chat & reactions ----------

roomsRouter.post(
  '/:id/messages',
  validate({ params: idParams, body: z.object({ text: z.string().max(500) }) }),
  async (req, res) => {
    res.status(201).json({ message: await sendMessage(currentUser(req), req.params.id as string, req.body.text) });
  },
);

roomsRouter.delete(
  '/:id/messages/:messageId',
  validate({ params: z.object({ id: objectId, messageId: objectId }) }),
  async (req, res) => {
    await deleteMessage(currentUser(req), req.params.id as string, req.params.messageId as string);
    res.status(204).end();
  },
);

roomsRouter.post(
  '/:id/reactions',
  validate({ params: idParams, body: z.object({ emoji: z.enum(REACTIONS) }) }),
  async (req, res) => {
    await react(currentUser(req), req.params.id as string, req.body.emoji);
    res.status(204).end();
  },
);

roomsRouter.delete('/:id/participants/:userId', validate({ params: participantParams }), async (req, res) => {
  await removeParticipant(currentUser(req), req.params.id as string, req.params.userId as string);
  res.status(204).end();
});
