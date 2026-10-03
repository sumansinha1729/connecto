import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useRoomStore } from '@/store/roomStore';
import { notify } from '@/utils/dialog';
import { goBack } from '@/utils/navigation';

/**
 * Mounted once at the root. Tells you when the room you're in ends or you're
 * removed, whether the room screen is open or minimised to the mini-player.
 */
export function RoomManager() {
  const exitReason = useRoomStore((s) => s.exitReason);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    // Leaving for a call is explained on the room screen itself (the call screen is on top)
    if (!exitReason || exitReason === 'call') return;
    const onRoomScreen = pathnameRef.current.startsWith('/room/') && pathnameRef.current !== '/room/create';
    notify(
      exitReason === 'closed' ? 'Room ended' : 'Removed from room',
      exitReason === 'closed' ? 'The host has ended this room.' : 'The host removed you from this room.',
    );
    useRoomStore.getState().clearExit();
    if (onRoomScreen) goBack();
  }, [exitReason]);

  return null;
}
