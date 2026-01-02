import { Router } from 'express';
import { z } from 'zod';

import { currentUser } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validate } from '../../middleware/validate';
import { idParams, objectId } from '../../utils/validators';
import {
  adjustWallet,
  approveListener,
  banUser,
  declinePayout,
  endRoomAsAdmin,
  getStats,
  getUserDetail,
  listApplications,
  listAuditLog,
  listPayouts,
  listReports,
  payPayout,
  rejectListener,
  resolveReport,
  revokeListener,
  searchUsers,
  unbanUser,
  type UserSearch,
} from './admin.service';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const page = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
};
const note = z.string().trim().min(3, 'Add a short note.').max(500);
const id = (req: { params: Record<string, unknown> }) => req.params.id as string;

adminRouter.get('/stats', async (_req, res) => {
  res.json(await getStats());
});

// ---------- Users ----------

adminRouter.get(
  '/users',
  validate({
    query: z.object({
      q: z.string().max(50).optional(),
      status: z.enum(['active', 'banned', 'deleted']).optional(),
      role: z.enum(['user', 'listener']).optional(),
      listenerStatus: z.enum(['none', 'pending', 'approved', 'rejected']).optional(),
      ...page,
    }),
  }),
  async (_req, res) => {
    res.json(await searchUsers(res.locals.query as UserSearch));
  },
);

adminRouter.get('/users/:id', validate({ params: idParams }), async (req, res) => {
  res.json(await getUserDetail(id(req)));
});

adminRouter.post('/users/:id/ban', validate({ params: idParams, body: z.object({ reason: note }) }), async (req, res) => {
  res.json({ user: await banUser(currentUser(req), id(req), req.body.reason) });
});

adminRouter.post('/users/:id/unban', validate({ params: idParams }), async (req, res) => {
  res.json({ user: await unbanUser(currentUser(req), id(req)) });
});

adminRouter.post(
  '/users/:id/wallet-adjustment',
  validate({
    params: idParams,
    body: z.object({
      amount: z
        .number()
        .int()
        .refine((n) => n !== 0 && Math.abs(n) <= 100_000, 'Amount must be between -100000 and 100000, not 0.'),
      reason: note,
    }),
  }),
  async (req, res) => {
    res.json(await adjustWallet(currentUser(req), id(req), req.body.amount, req.body.reason));
  },
);

adminRouter.post(
  '/users/:id/revoke-listener',
  validate({ params: idParams, body: z.object({ note }) }),
  async (req, res) => {
    res.json({ user: await revokeListener(currentUser(req), id(req), req.body.note) });
  },
);

// ---------- Listener applications ----------

adminRouter.get(
  '/listener-applications',
  validate({ query: z.object({ status: z.enum(['pending', 'approved', 'rejected']).default('pending'), ...page }) }),
  async (_req, res) => {
    const { status, ...paging } = res.locals.query as { status: 'pending' | 'approved' | 'rejected'; page: number; limit: number };
    res.json(await listApplications(status, paging));
  },
);

adminRouter.post(
  '/listener-applications/:id/approve',
  validate({ params: idParams, body: z.object({ note: note.optional() }) }),
  async (req, res) => {
    res.json({ user: await approveListener(currentUser(req), id(req), req.body.note) });
  },
);

adminRouter.post(
  '/listener-applications/:id/reject',
  validate({ params: idParams, body: z.object({ note }) }),
  async (req, res) => {
    res.json({ user: await rejectListener(currentUser(req), id(req), req.body.note) });
  },
);

// ---------- Reports ----------

adminRouter.get(
  '/reports',
  validate({ query: z.object({ status: z.enum(['open', 'reviewed', 'actioned']).default('open'), ...page }) }),
  async (_req, res) => {
    const { status, ...paging } = res.locals.query as { status: 'open' | 'reviewed' | 'actioned'; page: number; limit: number };
    res.json(await listReports(status, paging));
  },
);

adminRouter.post(
  '/reports/:id/resolve',
  validate({
    params: idParams,
    body: z.object({
      /** reviewed = no action needed, actioned = something was done */
      status: z.enum(['reviewed', 'actioned']),
      note: note.optional(),
      /** Also ban the reported user */
      ban: z.boolean().default(false),
    }),
  }),
  async (req, res) => {
    await resolveReport(currentUser(req), id(req), req.body);
    res.status(204).end();
  },
);

// ---------- Payouts ----------

adminRouter.get(
  '/payouts',
  validate({ query: z.object({ status: z.enum(['requested', 'paid', 'rejected']).default('requested'), ...page }) }),
  async (_req, res) => {
    const { status, ...paging } = res.locals.query as { status: 'requested' | 'paid' | 'rejected'; page: number; limit: number };
    res.json(await listPayouts(status, paging));
  },
);

adminRouter.post(
  '/payouts/:id/paid',
  validate({ params: idParams, body: z.object({ reference: z.string().trim().min(4, 'Enter the UPI/bank reference.').max(64) }) }),
  async (req, res) => {
    await payPayout(currentUser(req), id(req), req.body.reference);
    res.status(204).end();
  },
);

adminRouter.post('/payouts/:id/reject', validate({ params: idParams, body: z.object({ note }) }), async (req, res) => {
  await declinePayout(currentUser(req), id(req), req.body.note);
  res.status(204).end();
});

// ---------- Rooms & audit ----------

adminRouter.post('/rooms/:id/end', validate({ params: idParams }), async (req, res) => {
  await endRoomAsAdmin(currentUser(req), id(req));
  res.status(204).end();
});

adminRouter.get(
  '/audit-log',
  validate({ query: z.object({ targetUserId: objectId.optional(), ...page }) }),
  async (_req, res) => {
    res.json(await listAuditLog(res.locals.query as { page: number; limit: number; targetUserId?: string }));
  },
);
