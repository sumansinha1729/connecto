import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '@/utils/errors';

interface Options {
  /** Re-fetch silently every time the screen comes into focus */
  refetchOnFocus?: boolean;
}

/** Small data-fetching helper: loading, pull-to-refresh and error state for a screen. */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[], { refetchOnFocus = false }: Options = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFirstFocus = useRef(true);

  // `deps` decides when the fetcher identity changes, like useEffect's dependency list
  const run = useCallback(fetcher, deps);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      try {
        setData(await run());
        setError(null);
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [run],
  );

  useEffect(() => {
    load('initial');
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      if (refetchOnFocus) load('silent');
    }, [load, refetchOnFocus]),
  );

  const refresh = useCallback(() => load('refresh'), [load]);

  return { data, setData, loading, refreshing, error, refresh };
}
