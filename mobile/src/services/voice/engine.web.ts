import AgoraRTC, { type ConnectionState, type IAgoraRTCClient, type IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';

import type { VoiceCredentials } from '@/types';
import { MIC_BLOCKED_MESSAGE, type JoinOptions, type VoiceEngine, type VoiceListener, type VoiceStatus } from './types';

// Warnings and errors only, and don't upload logs to Agora
AgoraRTC.setLogLevel(2);
AgoraRTC.disableLogUpload();

/** Agora reports volume as 0–100; above this someone is talking */
const SPEAKING_LEVEL = 8;

const STATUS: Record<ConnectionState, VoiceStatus> = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  DISCONNECTING: 'connecting',
  DISCONNECTED: 'off',
};

let client: IAgoraRTCClient | null = null;
let mic: IMicrophoneAudioTrack | null = null;
let listener: VoiceListener | null = null;
let localUid = 0;
let muted = false;
const remote = new Set<number>();

const reportRemote = () => listener?.onRemoteUsers([...remote]);

/** Creates and publishes the microphone track. A blocked microphone keeps you listen-only. */
async function publishMic() {
  if (!client || mic) return;
  try {
    mic = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true });
    await mic.setMuted(muted);
    await client.publish(mic);
  } catch (error) {
    mic?.close();
    mic = null;
    console.warn('[voice] microphone unavailable', error);
    listener?.onStatus('connected', MIC_BLOCKED_MESSAGE);
  }
}

async function unpublishMic() {
  if (!client || !mic) return;
  await client.unpublish(mic).catch(() => {});
  mic.close();
  mic = null;
}

export const voiceEngine: VoiceEngine = {
  async join(credentials: VoiceCredentials, options: JoinOptions, l: VoiceListener) {
    await this.leave();
    listener = l;
    localUid = credentials.uid;
    muted = options.muted;
    remote.clear();

    const c = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
    client = c;
    c.on('connection-state-change', (state: ConnectionState) => {
      if (client === c) listener?.onStatus(STATUS[state]);
    });
    c.on('user-joined', (user) => {
      remote.add(Number(user.uid));
      reportRemote();
    });
    c.on('user-left', (user) => {
      remote.delete(Number(user.uid));
      reportRemote();
    });
    c.on('user-published', async (user, mediaType) => {
      if (mediaType !== 'audio') return;
      await c.subscribe(user, 'audio');
      user.audioTrack?.play();
    });
    c.on('volume-indicator', (levels: { uid: string | number; level: number }[]) => {
      listener?.onSpeaking(levels.filter((v) => v.level > SPEAKING_LEVEL).map((v) => Number(v.uid)));
    });
    c.on('token-privilege-will-expire', () => listener?.onTokenWillExpire());

    // Browsers may block sound until the page is clicked; the SDK resumes by itself after a click
    AgoraRTC.onAutoplayFailed = () => listener?.onStatus('connected', 'Tap anywhere on the page to hear the audio.');

    await c.setClientRole(options.canSpeak ? 'host' : 'audience');
    await c.join(credentials.appId, credentials.channel, credentials.token, credentials.uid);
    c.enableAudioVolumeIndicator();
    if (options.canSpeak) await publishMic();
  },

  async setCanSpeak(canSpeak, credentials) {
    if (!client) return;
    await client.renewToken(credentials.token);
    if (canSpeak) {
      await client.setClientRole('host');
      await publishMic();
    } else {
      await unpublishMic();
      await client.setClientRole('audience');
    }
  },

  async setMuted(value) {
    muted = value;
    await mic?.setMuted(value);
  },

  // Browsers choose the output device themselves
  async setSpeaker() {},

  async renewToken(token) {
    await client?.renewToken(token);
  },

  async leave() {
    const c = client;
    client = null;
    listener = null;
    remote.clear();
    mic?.close();
    mic = null;
    if (c) {
      c.removeAllListeners();
      await c.leave().catch(() => {});
    }
  },
};

/** Your own uid in the current channel */
export const currentLocalUid = () => localUid;
