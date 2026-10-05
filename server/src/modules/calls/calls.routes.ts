import { Router } from 'express';
import { z } from 'zod';

import { LANGUAGES } from '../../config/options';
import { currentUser, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParams, objectId } from '../../utils/validators';
import {
  acceptCall,
  endCall,
  findMatch,
  getActiveCall,
  getCallVoice,
  getHistory,
  rateCall,
  rejectCall,
  startCall,
} from './calls.service';

export const callsRouter = Router();
callsRouter.use(requireAuth);

/** Start ringing someone. Progress arrives as `call:*` socket events. */
/** Random id of the phone/browser making the request (another device on the same account stays out of the call) */
const deviceId = z.string().regex(/^[\w-]{8,64}$/).optional();

callsRouter.post('/', validate({ body: z.object({ userId: objectId, deviceId }) }), async (req, res) => {
  res.status(201).json(await startCall(currentUser(req), req.body.userId, req.body.deviceId));
});

callsRouter.get('/active', async (req, res) => {
  res.json({ call: await getActiveCall(currentUser(req)) });
});

callsRouter.get(
  '/history',
  validate({
    query: z.object({
      before: z.coerce.date().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }),
  }),
  async (req, res) => {
    res.json({ calls: await getHistory(currentUser(req), res.locals.query as { before?: Date; limit: number }) });
  },
);

callsRouter.post('/match', validate({ body: z.object({ language: z.enum(LANGUAGES).optional() }) }), async (req, res) => {
  res.json({ user: await findMatch(currentUser(req), req.body.language) });
});

callsRouter.post('/:id/accept', validate({ params: idParams, body: z.object({ deviceId }).default({}) }), async (req, res) => {
  res.json(await acceptCall(currentUser(req), req.params.id as string, req.body.deviceId));
});

/** Renewed voice credentials for an active call */
callsRouter.get('/:id/voice', validate({ params: idParams }), async (req, res) => {
  res.json({ voice: await getCallVoice(currentUser(req), req.params.id as string) });
});

callsRouter.post('/:id/reject', validate({ params: idParams }), async (req, res) => {
  await rejectCall(currentUser(req), req.params.id as string);
  res.status(204).end();
});

callsRouter.post('/:id/end', validate({ params: idParams }), async (req, res) => {
  await endCall(currentUser(req), req.params.id as string);
  res.status(204).end();
});

callsRouter.post(
  '/:id/rate',
  validate({ params: idParams, body: z.object({ stars: z.number().int().min(1).max(5) }) }),
  async (req, res) => {
    await rateCall(currentUser(req), req.params.id as string, req.body.stars);
    res.status(204).end();
  },
);
