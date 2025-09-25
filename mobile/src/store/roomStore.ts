import { create } from 'zustand';

import { api } from '@/services';
import type { Room, RoomParticipant, RoomRole } from '@/types';

export type RoomExitReason = 'closed' | 'removed';

interface RoomState {
  room: Room | null;
  speakingIds: string[];
  /** Set when the room ended or you were removed while inside it */
  exitReason: RoomExitReason | null;

  join: (roomId: string) => Promise<Room>;
  leave: () => Promise<void>;
  setHandRaised: (raised: boolean) => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
  setRole: (userId: string, role: Exclude<RoomRole, 'host'>) => Promise<void>;
  removeParticipant: (userId: string) => Promise<void>;

  // Realtime event handlers (wired up in store/bindings.ts)
  onUpdated: (room: Room) => void;
  onSpeaking: (roomId: string, userIds: string[]) => void;
  onExit: (roomId: string, reason: RoomExitReason) => void;
}

export const useRoomStore = create<RoomState>()((set, get) => {
  const roomId = () => {
    const id = get().room?.id;
    if (!id) throw new Error('Not in a room');
    return id;
  };

  return {
    room: null,
    speakingIds: [],
    exitReason: null,

    join: async (id) => {
      set({ room: null, speakingIds: [], exitReason: null });
      const room = await api.rooms.joinRoom(id);
      set({ room });
      return room;
    },

    leave: async () => {
      const id = get().room?.id;
      set({ room: null, speakingIds: [], exitReason: null });
      if (id) await api.rooms.leaveRoom(id);
    },

    setHandRaised: (raised) => api.rooms.setHandRaised(roomId(), raised),
    setMuted: (muted) => api.rooms.setMuted(roomId(), muted),
    setRole: (userId, role) => api.rooms.setRole(roomId(), userId, role),
    removeParticipant: (userId) => api.rooms.removeParticipant(roomId(), userId),

    onUpdated: (room) => {
      if (get().room?.id === room.id) set({ room });
    },

    onSpeaking: (id, userIds) => {
      if (get().room?.id === id) set({ speakingIds: userIds });
    },

    onExit: (id, reason) => {
      if (get().room?.id === id) set({ room: null, speakingIds: [], exitReason: reason });
    },
  };
});

export function findParticipant(room: Room | null, userId: string | undefined): RoomParticipant | undefined {
  return room?.participants.find((p) => p.user.id === userId);
}
