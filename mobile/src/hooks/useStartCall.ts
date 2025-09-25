import { router } from 'expo-router';
import { useCallback } from 'react';

import { CALL_RATE_PER_MIN } from '@/constants/config';
import { isCallActive, useCallStore } from '@/store/callStore';
import { useWalletStore } from '@/store/walletStore';
import type { User } from '@/types';
import { confirm } from '@/utils/dialog';

/** Checks the balance, starts the call and opens the call screen. */
export function useStartCall() {
  return useCallback(async (peer: User) => {
    if (isCallActive(useCallStore.getState().phase)) {
      router.push('/call');
      return;
    }
    if (useWalletStore.getState().balance < CALL_RATE_PER_MIN) {
      const recharge = await confirm({
        title: 'Not enough coins',
        message: `Calls cost ${CALL_RATE_PER_MIN} coins per minute. Recharge to start talking.`,
        confirmText: 'Recharge',
      });
      if (recharge) router.push('/recharge');
      return;
    }
    useCallStore.getState().startCall(peer);
    router.push('/call');
  }, []);
}
