import { create } from 'zustand';

import { api } from '@/services';
import type { CallDirection, CallEndReason, User } from '@/types';
import { getErrorMessage } from '@/utils/errors';

/**
 * idle → outgoing → connected → ended
 * idle → incoming → connected → ended
 */
export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connected' | 'ended';

interface CallState {
  phase: CallPhase;
  callId: string | null;
  peer: User | null;
  direction: CallDirection | null;
  connectedAt: number | null;
  muted: boolean;
  speaker: boolean;
  endReason: CallEndReason | null;
  durationSec: number;
  coins: number;
  /** Set when the call couldn't be started at all */
  error: string | null;
  rated: boolean;

  startCall: (peer: User) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  rate: (stars: number) => Promise<void>;
  reset: () => void;

  // Realtime event handlers (wired up in store/bindings.ts)
  onIncoming: (callId: string, from: User) => void;
  onAccepted: (callId: string) => void;
  onEnded: (callId: string, reason: CallEndReason, durationSec: number, coins: number) => void;
}

const initialState = {
  phase: 'idle' as CallPhase,
  callId: null,
  peer: null,
  direction: null,
  connectedAt: null,
  muted: false,
  speaker: false,
  endReason: null,
  durationSec: 0,
  coins: 0,
  error: null,
  rated: false,
};

export const isCallActive = (phase: CallPhase) => phase === 'outgoing' || phase === 'incoming' || phase === 'connected';

export const useCallStore = create<CallState>()((set, get) => ({
  ...initialState,

  startCall: async (peer) => {
    if (isCallActive(get().phase)) return;
    set({ ...initialState, phase: 'outgoing', peer, direction: 'outgoing' });
    try {
      const { callId } = await api.calls.startCall(peer.id);
      // The user may have hung up while the request was in flight
      if (get().phase !== 'outgoing') {
        await api.calls.endCall(callId);
        return;
      }
      set({ callId });
    } catch (error) {
      set({ phase: 'ended', error: getErrorMessage(error) });
    }
  },

  accept: async () => {
    const { callId, phase } = get();
    if (!callId || phase !== 'incoming') return;
    try {
      await api.calls.acceptCall(callId);
    } catch (error) {
      set({ phase: 'ended', error: getErrorMessage(error) });
    }
  },

  decline: async () => {
    const { callId } = get();
    if (callId) await api.calls.rejectCall(callId);
  },

  hangup: async () => {
    const { callId, phase } = get();
    if (!callId) {
      if (phase === 'outgoing') set({ phase: 'ended', endReason: 'cancelled' });
      return;
    }
    await api.calls.endCall(callId);
  },

  toggleMute: () => set((s) => ({ muted: !s.muted })),
  toggleSpeaker: () => set((s) => ({ speaker: !s.speaker })),

  rate: async (stars) => {
    const { callId } = get();
    if (!callId) return;
    set({ rated: true });
    await api.calls.rateCall(callId, stars);
  },

  reset: () => set(initialState),

  onIncoming: (callId, from) => {
    if (isCallActive(get().phase)) {
      // Busy: automatically decline the second call
      api.calls.rejectCall(callId).catch(() => {});
      return;
    }
    set({ ...initialState, phase: 'incoming', callId, peer: from, direction: 'incoming' });
  },

  onAccepted: (callId) => {
    if (get().callId !== callId) return;
    set({ phase: 'connected', connectedAt: Date.now() });
  },

  onEnded: (callId, reason, durationSec, coins) => {
    if (get().callId !== callId) return;
    set({ phase: 'ended', endReason: reason, durationSec, coins });
  },
}));
