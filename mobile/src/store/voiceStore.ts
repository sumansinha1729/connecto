import { create } from 'zustand';

import type { VoiceStatus } from '@/services/voice/types';

/** State of the live voice channel (call or room), filled by components/voice/VoiceManager */
interface VoiceState {
  status: VoiceStatus;
  /** Something the person should know, e.g. the microphone is blocked */
  message: string | null;
  /** Agora uids of the other people in the channel */
  remoteUids: number[];
  /** Agora uids of whoever is talking right now (including you) */
  speakingUids: number[];
}

export const initialVoiceState: VoiceState = { status: 'off', message: null, remoteUids: [], speakingUids: [] };

export const useVoiceStore = create<VoiceState>()(() => initialVoiceState);

// Development only: lets you (and browser tests) inspect the voice state from the console
if (__DEV__ && typeof window !== 'undefined') (window as unknown as { __voice: typeof useVoiceStore }).__voice = useVoiceStore;
