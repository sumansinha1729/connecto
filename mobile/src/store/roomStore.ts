import { create } from 'zustand';

import { api } from '@/services';
import type { Room, RoomParticipant, RoomRole, VoiceCredentials } from '@/types';

/** closed by the host, removed by the host, or left because a call connected */
export type RoomExitReason = 'closed' | 'removed' | 'call';

interface RoomState {
  room: Room | null;
  /** Agora credentials for the room (speaker or listen-only) */
  voice: VoiceCredentials | null;
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
  onVoice: (roomId: string, voice: VoiceCredentials | null) => void;
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
    voice: null,
    exitReason: null,

    join: async (id) => {
      set({ room: null, voice: null, exitReason: null });
      const { room, voice } = await api.rooms.joinRoom(id);
      set({ room, voice });
      return room;
    },

    leave: async () => {
      const id = get().room?.id;
      set({ room: null, voice: null, exitReason: null });
      if (id) await api.rooms.leaveRoom(id);
    },

    setHandRaised: (raised) => api.rooms.setHandRaised(roomId(), raised),
    setMuted: (muted) => api.rooms.setMuted(roomId(), muted),
    setRole: (userId, role) => api.rooms.setRole(roomId(), userId, role),
    removeParticipant: (userId) => api.rooms.removeParticipant(roomId(), userId),

    onUpdated: (room) => {
      if (get().room?.id === room.id) set({ room });
    },

    onVoice: (id, voice) => {
      if (get().room?.id === id) set({ voice });
    },

    onExit: (id, reason) => {
      if (get().room?.id === id) set({ room: null, voice: null, exitReason: reason });
    },
  };
});

export function findParticipant(room: Room | null, userId: string | undefined): RoomParticipant | undefined {
  return room?.participants.find((p) => p.user.id === userId);
}
