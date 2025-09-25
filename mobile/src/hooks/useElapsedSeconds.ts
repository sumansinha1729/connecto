import { useEffect, useState } from 'react';

/** Seconds elapsed since `startMs`, ticking every second. Returns 0 while `startMs` is null. */
export function useElapsedSeconds(startMs: number | null): number {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (startMs === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startMs]);

  return startMs === null ? 0 : Math.max(0, Math.floor((now - startMs) / 1000));
}
