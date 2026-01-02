import { Router } from 'express';
import { z } from 'zod';

import { currentUser, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { toMe } from '../users/user.serializer';
import { getEarningsSummary, requestWithdrawal, setPayoutMethod } from './earnings.service';

/** Listener earnings: balance, history, payout details and withdrawals */
export const earningsRouter = Router();
earningsRouter.use(requireAuth);

const payoutMethod = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('upi'),
    upiId: z.string().trim().regex(/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/, 'Enter a valid UPI ID, e.g. name@okicici.'),
    accountName: z.string().trim().min(2, 'Enter the account holder’s name.').max(80),
  }),
  z.object({
    kind: z.literal('bank'),
    accountName: z.string().trim().min(2, 'Enter the account holder’s name.').max(80),
    accountNumber: z.string().trim().regex(/^\d{9,18}$/, 'Account number must be 9–18 digits.'),
    ifsc: z.string().trim().regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, 'Enter a valid IFSC code, e.g. SBIN0001234.'),
  }),
]);

earningsRouter.get('/', async (req, res) => {
  res.json(await getEarningsSummary(currentUser(req)));
});

earningsRouter.put('/payout-method', validate({ body: payoutMethod }), async (req, res) => {
  const user = currentUser(req);
  await setPayoutMethod(user, req.body);
  res.json({ user: toMe(user) });
});

earningsRouter.post(
  '/withdrawals',
  validate({ body: z.object({ amountPaise: z.number().int().positive().optional() }) }),
  async (req, res) => {
    res.status(201).json({ payout: await requestWithdrawal(currentUser(req), req.body.amountPaise) });
  },
);
