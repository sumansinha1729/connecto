import type { VoiceCredentials } from '@/types';

/**
 * - `off`: no voice for this session (e.g. Agora isn't configured on the server)
 * - `unavailable`: this build can't play voice (Expo Go has no Agora module)
 */
export type VoiceStatus = 'off' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'unavailable';

export interface JoinOptions {
  /** Publish the microphone (1:1 calls, room host and speakers) or only listen */
  canSpeak: boolean;
  muted: boolean;
  /** Start on the loudspeaker (rooms) instead of the earpiece (calls). Phones only. */
  speaker: boolean;
}

export interface VoiceListener {
  onStatus(status: VoiceStatus, message?: string): void;
  /** Other people in the channel (Agora uids) */
  onRemoteUsers(uids: number[]): void;
  /** Who is talking right now, including you (Agora uids) */
  onSpeaking(uids: number[]): void;
  /** The token runs out soon: fetch fresh credentials and call `renewToken` */
  onTokenWillExpire(): void;
}

/**
 * One voice channel at a time. Implemented with Agora's Web SDK in the browser
 * (`engine.web.ts`) and react-native-agora on phones (`engine.native.ts`).
 */
export interface VoiceEngine {
  join(credentials: VoiceCredentials, options: JoinOptions, listener: VoiceListener): Promise<void>;
  /** Switch between speaking and listen-only (room role changed), with credentials for the new role */
  setCanSpeak(canSpeak: boolean, credentials: VoiceCredentials): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  setSpeaker(on: boolean): Promise<void>;
  renewToken(token: string): Promise<void>;
  leave(): Promise<void>;
}

/** Thrown when the microphone can't be used; the session still joins listen-only */
export const MIC_BLOCKED_MESSAGE = 'Microphone is blocked. Allow it in your settings so the other person can hear you.';
