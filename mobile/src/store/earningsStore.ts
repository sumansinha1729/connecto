import { create } from 'zustand';

import { api } from '@/services';
import type { EarningsSummary } from '@/types';

/** Listener earnings (₹). The balance also updates live via `earnings:balance`. */
interface EarningsState {
  summary: EarningsSummary | null;
  refresh: () => Promise<void>;
  withdraw: () => Promise<void>;
  setBalance: (balancePaise: number) => void;
  reset: () => void;
}

export const useEarningsStore = create<EarningsState>()((set, get) => ({
  summary: null,

  refresh: async () => {
    set({ summary: await api.earnings.getSummary() });
  },

  withdraw: async () => {
    await api.earnings.withdraw();
    await get().refresh();
  },

  setBalance: (balancePaise) => {
    const summary = get().summary;
    if (summary) set({ summary: { ...summary, balancePaise } });
  },

  reset: () => set({ summary: null }),
}));
