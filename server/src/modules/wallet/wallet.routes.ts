import crypto from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { env } from '../../config/env';
import { RECHARGE_PACKS } from '../../config/options';
import { currentUser, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { assertActsAsUser } from '../users/accountRules';
import { ApiError } from '../../utils/ApiError';
import { credit, getBalance, listTransactions, toTransactionDto } from './wallet.service';

export const walletRouter = Router();
walletRouter.use(requireAuth);

const pricing = () => ({
  callRatePerMin: env.CALL_RATE_COINS_PER_MIN,
  listenerEarningPaisePerMin: env.LISTENER_EARNING_PAISE_PER_MIN,
});

/** Balance + latest transactions + call pricing */
walletRouter.get('/', async (req, res) => {
  const user = currentUser(req);
  const [balance, transactions] = await Promise.all([getBalance(user._id), listTransactions(user._id)]);
  res.json({ balance, transactions: transactions.map(toTransactionDto), pricing: pricing() });
});

/** Older transactions, paginated with ?before=<ISO date of the last item> */
walletRouter.get(
  '/transactions',
  validate({
    query: z.object({
      before: z.coerce.date().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(30),
    }),
  }),
  async (req, res) => {
    const { before, limit } = res.locals.query as { before?: Date; limit: number };
    const transactions = await listTransactions(currentUser(req)._id, { before, limit });
    res.json({ transactions: transactions.map(toTransactionDto) });
  },
);

walletRouter.get('/packs', (_req, res) => {
  res.json({ packs: RECHARGE_PACKS, pricing: pricing() });
});

/**
 * Development-only recharge so the app can be tested without payments.
 * Replaced by Razorpay orders + webhooks in the payments step.
 */
walletRouter.post('/recharge', validate({ body: z.object({ packId: z.string() }) }), async (req, res) => {
  if (env.isProduction) throw ApiError.forbidden('Payments are not enabled yet.');
  const pack = RECHARGE_PACKS.find((p) => p.id === req.body.packId);
  if (!pack) throw ApiError.notFound('This pack is no longer available.');

  const user = currentUser(req);
  assertActsAsUser(user, 'buy coins');
  const total = pack.coins + pack.bonus;
  const { balance } = await credit({
    userId: user._id,
    amount: total,
    type: 'recharge',
    description: pack.bonus ? `Recharge ₹${pack.priceInr} (+${pack.bonus} bonus)` : `Recharge ₹${pack.priceInr}`,
    idempotencyKey: `dev-recharge:${crypto.randomUUID()}`,
    meta: { packId: pack.id, priceInr: pack.priceInr, provider: 'dev' },
  });
  const transactions = await listTransactions(user._id);
  res.json({ balance, transactions: transactions.map(toTransactionDto) });
});
