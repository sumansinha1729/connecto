import { RECHARGE_PACKS } from '@/constants/options';
import type { WalletService } from '../contracts';
import { realtime } from '../realtime';
import { ApiError } from '@/utils/errors';
import { persist } from './db';
import { addTransaction, adjustBalance, latency, requireMe } from './helpers';

export const mockWallet: WalletService = {
  async getWallet() {
    await latency();
    const { db, me } = await requireMe();
    return { balance: db.wallets[me.id] ?? 0, transactions: db.transactions[me.id] ?? [] };
  },

  async recharge(packId) {
    // Simulates the payment gateway round trip
    await latency(1200, 1800);
    const { db, me } = await requireMe();
    const pack = RECHARGE_PACKS.find((p) => p.id === packId);
    if (!pack) throw new ApiError('NOT_FOUND', 'This pack is no longer available.');

    const total = pack.coins + pack.bonus;
    const balance = adjustBalance(db, me.id, total);
    addTransaction(
      db,
      me.id,
      'recharge',
      total,
      pack.bonus ? `Recharge ₹${pack.priceInr} (+${pack.bonus} bonus)` : `Recharge ₹${pack.priceInr}`,
    );
    persist();
    realtime.emit('wallet:balance', { balance });
    return { balance, transactions: db.transactions[me.id] ?? [] };
  },
};
