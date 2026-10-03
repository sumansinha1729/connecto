import { create } from 'zustand';

import { api } from '@/services';
import type { Room, RoomMessage, RoomParticipant, RoomReaction, RoomRole, VoiceCredentials } from '@/types';

/** closed by the host, removed by the host / a co-host, or left because a call connected */
export type RoomExitReason = 'closed' | 'removed' | 'call';

/** An emoji floating up over the stage */
export interface FloatingReaction {
  id: number;
  emoji: string;
}

const MAX_MESSAGES = 100;
const REACTION_LIFETIME_MS = 2600;
const NOTICE_LIFETIME_MS = 4000;

interface RoomState {
  /** The room you're in. Stays set while the room screen is minimised (mini-player). */
  room: Room | null;
  /** Agora credentials for the room (speaker or listen-only) */
  voice: VoiceCredentials | null;
  messages: RoomMessage[];
  reactions: FloatingReaction[];
  /** Short notice shown in the room, e.g. "Priya muted you" */
  notice: string | null;
  /** Set when the room ended or you were removed while inside it */
  exitReason: RoomExitReason | null;

  /** Joins (or re-opens, if you're already in it) a room */
  join: (roomId: string) => Promise<Room>;
  leave: () => Promise<void>;
  setHandRaised: (raised: boolean) => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
  setRole: (userId: string, role: Exclude<RoomRole, 'host'>) => Promise<void>;
  muteParticipant: (userId: string) => Promise<void>;
  removeParticipant: (userId: string) => Promise<void>;
  updateRoom: (input: { title?: string; description?: string }) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  react: (emoji: RoomReaction) => void;
  clearExit: () => void;
  reset: () => void;

  // Realtime event handlers (wired up in store/bindings.ts)
  onUpdated: (room: Room) => void;
  onVoice: (roomId: string, voice: VoiceCredentials | null) => void;
  onMessage: (roomId: string, message: RoomMessage) => void;
  onMessageDeleted: (roomId: string, messageId: string) => void;
  onReaction: (roomId: string, emoji: string) => void;
  onMuted: (roomId: string, by: string) => void;
  onExit: (roomId: string, reason: RoomExitReason) => void;
}

const empty = { room: null, voice: null, messages: [], reactions: [], notice: null, exitReason: null };

let reactionId = 1;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

export const useRoomStore = create<RoomState>()((set, get) => {
  const roomId = () => {
    const id = get().room?.id;
    if (!id) throw new Error('Not in a room');
    return id;
  };

  const showNotice = (notice: string) => {
    clearTimeout(noticeTimer);
    set({ notice });
    noticeTimer = setTimeout(() => set({ notice: null }), NOTICE_LIFETIME_MS);
  };

  return {
    ...empty,

    join: async (id) => {
      const current = get().room;
      if (current?.id === id) return current;
      set(empty);
      const { room, voice, messages } = await api.rooms.joinRoom(id);
      set({ room, voice, messages });
      return room;
    },

    leave: async () => {
      const id = get().room?.id;
      set(empty);
      if (id) await api.rooms.leaveRoom(id);
    },

    setHandRaised: (raised) => api.rooms.setHandRaised(roomId(), raised),
    setMuted: (muted) => api.rooms.setMuted(roomId(), muted),
    setRole: (userId, role) => api.rooms.setRole(roomId(), userId, role),
    muteParticipant: (userId) => api.rooms.muteParticipant(roomId(), userId),
    removeParticipant: (userId) => api.rooms.removeParticipant(roomId(), userId),
    updateRoom: (input) => api.rooms.updateRoom(roomId(), input),

    // The message comes back through `room:message`, like everyone else's
    sendMessage: async (text) => {
      await api.rooms.sendMessage(roomId(), text);
    },
    deleteMessage: (messageId) => api.rooms.deleteMessage(roomId(), messageId),

    react: (emoji) => {
      // Too-fast taps are refused by the server; that's fine to ignore
      api.rooms.react(roomId(), emoji).catch(() => {});
    },

    clearExit: () => set({ exitReason: null }),
    reset: () => set(empty),

    onUpdated: (room) => {
      if (get().room?.id === room.id) set({ room });
    },

    onVoice: (id, voice) => {
      if (get().room?.id === id) set({ voice });
    },

    onMessage: (id, message) => {
      if (get().room?.id !== id || get().messages.some((m) => m.id === message.id)) return;
      set({ messages: [...get().messages, message].slice(-MAX_MESSAGES) });
    },

    onMessageDeleted: (id, messageId) => {
      if (get().room?.id === id) set({ messages: get().messages.filter((m) => m.id !== messageId) });
    },

    onReaction: (id, emoji) => {
      if (get().room?.id !== id) return;
      const reaction = { id: reactionId++, emoji };
      set({ reactions: [...get().reactions, reaction].slice(-30) });
      setTimeout(() => set({ reactions: get().reactions.filter((r) => r.id !== reaction.id) }), REACTION_LIFETIME_MS);
    },

    onMuted: (id, by) => {
      if (get().room?.id === id) showNotice(`${by} muted you. Tap the mic when you want to talk again.`);
    },

    onExit: (id, reason) => {
      if (get().room?.id === id) set({ ...empty, exitReason: reason });
    },
  };
});

export function findParticipant(room: Room | null, userId: string | undefined): RoomParticipant | undefined {
  return room?.participants.find((p) => p.user.id === userId);
}

export const isModerator = (role: RoomRole | undefined) => role === 'host' || role === 'cohost';
export const canSpeakIn = (role: RoomRole | undefined) => role !== undefined && role !== 'listener';
