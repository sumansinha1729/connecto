import { create } from 'zustand';

import { api } from '@/services';
import type { Transaction } from '@/types';

interface WalletState {
  balance: number;
  transactions: Transaction[];
  loaded: boolean;
  refresh: () => Promise<void>;
  recharge: (packId: string) => Promise<void>;
  setBalance: (balance: number) => void;
  reset: () => void;
}

export const useWalletStore = create<WalletState>()((set) => ({
  balance: 0,
  transactions: [],
  loaded: false,

  refresh: async () => {
    const wallet = await api.wallet.getWallet();
    set({ ...wallet, loaded: true });
  },

  recharge: async (packId) => {
    const wallet = await api.wallet.recharge(packId);
    set({ ...wallet, loaded: true });
  },

  setBalance: (balance) => set({ balance }),

  reset: () => set({ balance: 0, transactions: [], loaded: false }),
}));
