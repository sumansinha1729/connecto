import { findParticipant, useRoomStore } from '@/store/roomStore';
import { confirm } from '@/utils/dialog';

/**
 * Leave the current room. The host is asked first: a co-host takes over if there is
 * one, otherwise the room ends for everyone. Returns false if they changed their mind.
 */
export async function leaveRoomWithConfirm(meId: string | undefined): Promise<boolean> {
  const { room } = useRoomStore.getState();
  if (!room) return true;
  if (findParticipant(room, meId)?.role === 'host') {
    const next = room.participants.find((p) => p.role === 'cohost');
    const ok = await confirm(
      next
        ? { title: 'Leave the room?', message: `${next.user.name} will take over as host.`, confirmText: 'Leave' }
        : { title: 'End the room?', message: 'You’re the host and there’s no co-host, so leaving ends the room for everyone.', confirmText: 'End room', destructive: true },
    );
    if (!ok) return false;
  }
  await useRoomStore.getState().leave();
  return true;
}

/** "just started", "live 12 min", "live 1 h 05 min" */
export function liveFor(createdAt: string): string {
  const min = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);
  if (min < 1) return 'just started';
  if (min < 60) return `live ${min} min`;
  return `live ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}
