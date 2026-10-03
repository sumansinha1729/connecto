import { useQueryClient } from '@tanstack/react-query';
import { useState, useSyncExternalStore } from 'react';

import { errorMessage, sessionStore } from '../api/client';
import { toast } from '../components/dialogs';

/** The signed-in admin, or null */
export const useSession = () => useSyncExternalStore(sessionStore.subscribe, sessionStore.get);

/**
 * Runs an admin action (approve, ban, mark paid…): shows which button is busy,
 * a toast with the result, and refreshes every list afterwards.
 */
export function useAction() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<unknown>, success: string): Promise<boolean> {
    setBusy(key);
    try {
      await action();
      toast(success);
      await queryClient.invalidateQueries();
      return true;
    } catch (error) {
      toast(errorMessage(error), true);
      return false;
    } finally {
      setBusy(null);
    }
  }

  return { busy, run };
}
