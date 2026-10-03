import { PermissionsAndroid, Platform } from 'react-native';
import type * as AgoraModule from 'react-native-agora';

import type { VoiceCredentials } from '@/types';
import { MIC_BLOCKED_MESSAGE, type JoinOptions, type VoiceEngine, type VoiceListener, type VoiceStatus } from './types';

/**
 * react-native-agora is native code: it exists in our own builds of the app,
 * but not in Expo Go. Load it lazily so the rest of the app still works there.
 */
let agora: typeof AgoraModule | null = null;
try {
  agora = require('react-native-agora');
} catch {
  agora = null;
}

const UNAVAILABLE_MESSAGE = 'Voice needs the Connecto test app. Expo Go can’t play call audio.';

/** Agora reports volume as 0–255; above this someone is talking */
const SPEAKING_VOLUME = 25;

let engine: AgoraModule.IRtcEngine | null = null;
let engineAppId: string | null = null;
let listener: VoiceListener | null = null;
let localUid = 0;
const remote = new Set<number>();

const reportRemote = () => listener?.onRemoteUsers([...remote]);

function statusFor(state: AgoraModule.ConnectionStateType): VoiceStatus {
  const s = agora!.ConnectionStateType;
  switch (state) {
    case s.ConnectionStateConnecting:
      return 'connecting';
    case s.ConnectionStateConnected:
      return 'connected';
    case s.ConnectionStateReconnecting:
      return 'reconnecting';
    case s.ConnectionStateFailed:
      return 'failed';
    default:
      return 'off';
  }
}

const handler: AgoraModule.IRtcEngineEventHandler = {
  onJoinChannelSuccess: () => listener?.onStatus('connected'),
  onConnectionStateChanged: (_connection, state) => listener?.onStatus(statusFor(state)),
  onUserJoined: (_connection, uid) => {
    remote.add(uid);
    reportRemote();
  },
  onUserOffline: (_connection, uid) => {
    remote.delete(uid);
    reportRemote();
  },
  onAudioVolumeIndication: (_connection, speakers) => {
    // uid 0 means "me"
    listener?.onSpeaking(speakers.filter((s) => (s.volume ?? 0) > SPEAKING_VOLUME).map((s) => (s.uid ? s.uid : localUid)));
  },
  onTokenPrivilegeWillExpire: () => listener?.onTokenWillExpire(),
  onError: (code, message) => console.warn('[voice] error', code, message),
};

function getEngine(appId: string): AgoraModule.IRtcEngine | null {
  if (!agora) return null;
  if (engine && engineAppId === appId) return engine;
  try {
    engine?.release();
    const created = agora.createAgoraRtcEngine();
    const result = created.initialize({ appId, channelProfile: agora.ChannelProfileType.ChannelProfileLiveBroadcasting });
    if (result < 0) throw new Error(`initialize failed (${result})`);
    created.registerEventHandler(handler);
    created.enableAudio();
    created.enableAudioVolumeIndication(300, 3, true);
    engine = created;
    engineAppId = appId;
    return engine;
  } catch (error) {
    console.warn('[voice] Agora is not available in this build', error);
    agora = null;
    engine = null;
    return null;
  }
}

async function micAllowed(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function role(canSpeak: boolean) {
  return canSpeak ? agora!.ClientRoleType.ClientRoleBroadcaster : agora!.ClientRoleType.ClientRoleAudience;
}

export const voiceEngine: VoiceEngine = {
  async join(credentials: VoiceCredentials, options: JoinOptions, l: VoiceListener) {
    await this.leave();
    listener = l;
    localUid = credentials.uid;
    remote.clear();

    const e = getEngine(credentials.appId);
    if (!e) {
      l.onStatus('unavailable', UNAVAILABLE_MESSAGE);
      return;
    }
    const canSpeak = options.canSpeak && (await micAllowed());
    l.onStatus('connecting', options.canSpeak && !canSpeak ? MIC_BLOCKED_MESSAGE : undefined);

    e.setDefaultAudioRouteToSpeakerphone(options.speaker);
    e.joinChannel(credentials.token, credentials.channel, credentials.uid, {
      channelProfile: agora!.ChannelProfileType.ChannelProfileLiveBroadcasting,
      clientRoleType: role(canSpeak),
      publishMicrophoneTrack: canSpeak,
      autoSubscribeAudio: true,
    });
    e.muteLocalAudioStream(options.muted);
  },

  async setCanSpeak(canSpeak, credentials) {
    if (!engine) return;
    const allowed = canSpeak && (await micAllowed());
    engine.renewToken(credentials.token);
    engine.updateChannelMediaOptions({ clientRoleType: role(allowed), publishMicrophoneTrack: allowed });
    if (canSpeak && !allowed) listener?.onStatus('connected', MIC_BLOCKED_MESSAGE);
  },

  async setMuted(muted) {
    engine?.muteLocalAudioStream(muted);
  },

  async setSpeaker(on) {
    engine?.setEnableSpeakerphone(on);
  },

  async renewToken(token) {
    engine?.renewToken(token);
  },

  async leave() {
    listener = null;
    remote.clear();
    engine?.leaveChannel();
  },
};

/** Your own uid in the current channel */
export const currentLocalUid = () => localUid;
