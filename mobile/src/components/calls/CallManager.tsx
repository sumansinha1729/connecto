import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform, Vibration } from 'react-native';

import { useCallStore } from '@/store/callStore';

/**
 * Mounted once at the root. Opens the call screen when a call comes in
 * and vibrates the phone while it rings.
 */
export function CallManager() {
  const phase = useCallStore((s) => s.phase);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (phase === 'incoming' && pathnameRef.current !== '/call') router.push('/call');
  }, [phase]);

  useEffect(() => {
    if (phase !== 'incoming' || Platform.OS === 'web') return;
    Vibration.vibrate([0, 800, 1200], true);
    return () => Vibration.cancel();
  }, [phase]);

  return null;
}
