import { create } from 'zustand';

import { api } from '@/services';
import { currentDeviceId } from '@/services/device';
import type { CallDirection, CallEndReason, User, VoiceCredentials } from '@/types';
import { notify } from '@/utils/dialog';
import { ApiError, getErrorMessage } from '@/utils/errors';

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
  /** Agora credentials for this call (null in demo mode or until Agora is configured) */
  voice: VoiceCredentials | null;
  muted: boolean;
  speaker: boolean;
  endReason: CallEndReason | null;
  durationSec: number;
  coins: number;
  /** What the listener earned (paise) */
  earnedPaise: number;
  /** Set when the call couldn't be started at all */
  error: string | null;
  rated: boolean;
  /** Set when a call was brought back from the server (app reopened, missed events) so the call screen opens */
  restoredAt: number | null;

  startCall: (peer: User) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  /** `reason` is shown on your end screen instead of "Call ended" (e.g. the audio never connected) */
  hangup: (reason?: CallEndReason) => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  rate: (stars: number) => Promise<void>;
  reset: () => void;
  /** Makes the app agree with the server about your current call (see syncWithServer below) */
  syncWithServer: () => Promise<void>;

  // Realtime event handlers (wired up in store/bindings.ts)
  onIncoming: (callId: string, from: User) => void;
  onAccepted: (callId: string, voice: VoiceCredentials | null, deviceId: string | null) => void;
  onEnded: (callId: string, reason: CallEndReason, durationSec: number, coins: number, earnedPaise: number) => void;
}

const initialState = {
  phase: 'idle' as CallPhase,
  callId: null,
  peer: null,
  direction: null,
  connectedAt: null,
  voice: null,
  muted: false,
  speaker: false,
  endReason: null,
  durationSec: 0,
  coins: 0,
  earnedPaise: 0,
  error: null,
  rated: false,
  restoredAt: null,
};

/** A reason the app decided itself, shown instead of the server's when the call ends */
let localEndReason: CallEndReason | null = null;

const isNotFound = (error: unknown) => error instanceof ApiError && error.code === 'NOT_FOUND';

export const isCallActive = (phase: CallPhase) => phase === 'outgoing' || phase === 'incoming' || phase === 'connected';

export const useCallStore = create<CallState>()((set, get) => ({
  ...initialState,

  startCall: async (peer) => {
    if (isCallActive(get().phase)) return;
    localEndReason = null;
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
      const { voice } = await api.calls.acceptCall(callId);
      // Usually "call:accepted" arrives first; this covers it getting lost
      if (get().callId === callId && get().phase === 'incoming') set({ phase: 'connected', connectedAt: Date.now() });
      if (get().callId === callId) set({ voice });
    } catch (error) {
      if (get().callId === callId) set({ phase: 'ended', error: getErrorMessage(error) });
    }
  },

  decline: async () => {
    const { callId } = get();
    if (!callId) return;
    try {
      await api.calls.rejectCall(callId);
    } catch (error) {
      if (isNotFound(error)) set({ phase: 'ended' });
      else notify('Couldn’t decline the call', 'Check your internet connection and try again.');
    }
  },

  hangup: async (reason) => {
    const { callId, phase } = get();
    if (!callId) {
      if (phase === 'outgoing') set({ phase: 'ended', endReason: 'cancelled' });
      return;
    }
    localEndReason = reason ?? null;
    try {
      await api.calls.endCall(callId);
    } catch (error) {
      if (isNotFound(error)) {
        if (get().callId === callId && isCallActive(get().phase)) set({ phase: 'ended', endReason: localEndReason });
        return;
      }
      // Still on: billing continues until the server hears about it, so say so
      notify('Couldn’t end the call', 'Check your internet connection and tap the red button again.');
      get().syncWithServer();
    }
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
    if (get().callId === callId) return; // same ring delivered twice
    // The server only rings listeners who are in no call at all, so if this app still thinks it's
    // in one, that state is stale (e.g. a missed "call ended" while offline): drop it and ring.
    // Never auto-decline here: a stuck screen must not turn callers away.
    if (isCallActive(get().phase)) console.warn('[call] replacing a stale call state with an incoming call');
    localEndReason = null;
    set({ ...initialState, phase: 'incoming', callId, peer: from, direction: 'incoming' });
  },

  onAccepted: (callId, voice, deviceId) => {
    const s = get();
    if (s.callId !== callId) return;
    // Answered on another phone/tab of the same account: this one stays out of the call
    if (s.direction === 'incoming' && deviceId && deviceId !== currentDeviceId()) {
      set({ phase: 'ended', endReason: 'answered_elsewhere' });
      return;
    }
    set({ phase: 'connected', connectedAt: s.connectedAt ?? Date.now(), voice: voice ?? s.voice });
  },

  onEnded: (callId, reason, durationSec, coins, earnedPaise) => {
    if (get().callId !== callId) return;
    const endReason = localEndReason ?? reason;
    localEndReason = null;
    set({ phase: 'ended', endReason, durationSec, coins, earnedPaise });
  },

  /**
   * Socket events can be missed (a network blip, the app in the background, a server restart),
   * so after reconnecting, and every so often during a call, ask the server what's going on:
   * - it has a call for this device that the app isn't showing → show it (e.g. app reopened mid-call)
   * - the app shows a call the server has finished → end it here too
   */
  syncWithServer: async () => {
    let server;
    try {
      server = await api.calls.getActive();
    } catch {
      return; // offline: the next reconnect tries again
    }
    const s = get();
    const forThisDevice = server && (!server.deviceId || server.deviceId === currentDeviceId());

    if (server && forThisDevice) {
      if (s.callId === server.callId) {
        if (server.status === 'active' && s.phase !== 'connected' && isCallActive(s.phase)) {
          set({ phase: 'connected', connectedAt: Date.parse(server.answeredAt ?? '') || Date.now(), voice: server.voice ?? s.voice });
        }
        return;
      }
      if (s.phase === 'outgoing' && !s.callId) return; // our own "start call" request is still on its way
      const answeredAt = server.answeredAt ? Date.parse(server.answeredAt) : null;
      set({
        ...initialState,
        callId: server.callId,
        peer: server.peer,
        direction: server.direction,
        phase: server.status === 'active' ? 'connected' : server.direction === 'incoming' ? 'incoming' : 'outgoing',
        connectedAt: server.status === 'active' ? (answeredAt ?? Date.now()) : null,
        voice: server.voice,
        restoredAt: Date.now(),
      });
      return;
    }

    // The server has no call for this device, but the app still shows one
    const { callId } = s;
    if (!callId || !isCallActive(s.phase)) return;
    if (server?.callId === callId) {
      set({ phase: 'ended', endReason: 'answered_elsewhere' });
      return;
    }
    // It ended while we weren't listening: fill in the details from the call history
    const record = await api.calls
      .getHistory()
      .then((calls) => calls.find((c) => c.id === callId))
      .catch(() => undefined);
    if (get().callId !== callId || !isCallActive(get().phase)) return;
    set({
      phase: 'ended',
      endReason: localEndReason,
      durationSec: record?.durationSec ?? 0,
      coins: record?.coins ?? 0,
      earnedPaise: record?.earnedPaise ?? 0,
    });
    localEndReason = null;
  },
}));
