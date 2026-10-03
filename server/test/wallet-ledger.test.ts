// The coin ledger under concurrency: never negative, idempotent credits/debits, ledger = balance
import { check, startTestDb } from './helpers';

import { after, before, test } from 'node:test';
import { Types } from 'mongoose';

import { disconnectDb } from '../src/config/db';
import { Transaction } from '../src/modules/wallet/wallet.model';
import { credit, debit, getBalance } from '../src/modules/wallet/wallet.service';

before(() => startTestDb('wallet'));
after(disconnectDb);

const userId = new Types.ObjectId();

test('concurrent debits never overspend', async () => {
  await credit({ userId, amount: 50, type: 'signup_bonus', description: 'bonus', idempotencyKey: 'bonus:1' });

  // 20 debits of 10 at the same time against a balance of 50
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, (_, i) => debit({ userId, amount: 10, type: 'call_charge', description: `minute ${i}` })),
  );
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const insufficient = results.filter((r) => r.status === 'rejected' && (r.reason as { code?: string }).code === 'INSUFFICIENT_BALANCE').length;
  check('exactly 5 of 20 concurrent debits succeed', ok === 5, { ok });
  check('the other 15 fail with INSUFFICIENT_BALANCE', insufficient === 15, { insufficient });
  check('balance never goes negative (ends at 0)', (await getBalance(userId)) === 0, await getBalance(userId));
  check('ledger has 5 debit rows', (await Transaction.countDocuments({ userId, type: 'call_charge' })) === 5);
});

test('duplicate payment webhooks credit once', async () => {
  const credits = await Promise.all(
    Array.from({ length: 10 }, () => credit({ userId, amount: 100, type: 'recharge', description: 'pay', idempotencyKey: 'razorpay:pay_123' })),
  );
  check('duplicate credits applied exactly once', credits.filter((c) => c.applied).length === 1, credits);
  check('balance is 100 after duplicate webhooks', (await getBalance(userId)) === 100, await getBalance(userId));
});

test('retried debit with the same key charges once', async () => {
  const d1 = await debit({ userId, amount: 10, type: 'call_charge', description: 'm', idempotencyKey: 'call:1:min:1' });
  const d2 = await debit({ userId, amount: 10, type: 'call_charge', description: 'm', idempotencyKey: 'call:1:min:1' });
  check('charged once', d1.applied && !d2.applied && (await getBalance(userId)) === 90, { d1, d2 });

  const sum = await Transaction.aggregate([{ $match: { userId } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  check('ledger sum equals wallet balance', sum[0].total === (await getBalance(userId)), { sum: sum[0].total });
});
