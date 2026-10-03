import { useEffect, useRef } from 'react';

import { api } from '@/services';
import { voiceEngine } from '@/services/voice/engine';
import type { VoiceListener, VoiceStatus } from '@/services/voice/types';
import { useAuthStore } from '@/store/authStore';
import { useCallStore } from '@/store/callStore';
import { findParticipant, useRoomStore } from '@/store/roomStore';
import { initialVoiceState, useVoiceStore } from '@/store/voiceStore';

const NOT_CONFIGURED = 'Voice isn’t set up on the server yet (Agora keys missing).';
const FAILED = 'Couldn’t connect the audio. Check your internet connection.';

/** Voice operations run one after another, so a quick leave → join can't interleave */
let queue: Promise<void> = Promise.resolve();
function enqueue(task: () => Promise<void>) {
  queue = queue.then(task).catch((error) => {
    console.warn('[voice]', error);
    useVoiceStore.setState({ status: 'failed', message: FAILED });
  });
}

/**
 * Mounted once at the root. Joins the voice channel of the connected call or
 * the room you're in, and keeps it in sync: mute, speaker, role changes and
 * token renewal. One voice session at a time; a call takes priority.
 */
export function VoiceManager() {
  const meId = useAuthStore((s) => s.user?.id);
  const call = useCallStore();
  const room = useRoomStore((s) => s.room);
  const roomVoice = useRoomStore((s) => s.voice);
  const me = findParticipant(room, meId);

  const kind = call.phase === 'connected' ? 'call' : room ? 'room' : null;
  const sessionId = kind === 'call' ? call.callId : kind === 'room' ? room!.id : null;
  const credentials = kind === 'call' ? call.voice : kind === 'room' ? roomVoice : null;
  const muted = kind === 'call' ? call.muted : (me?.isMuted ?? true);
  // Calls start on the earpiece (like a phone call), rooms on the loudspeaker
  const speaker = kind === 'call' ? call.speaker : true;
  const sessionKey = kind && sessionId ? `${kind}:${sessionId}` : null;

  // Latest values for async callbacks
  const latest = useRef({ kind, sessionId, sessionKey, credentials, muted, speaker });
  latest.current = { kind, sessionId, sessionKey, credentials, muted, speaker };
  const joined = useRef<{ key: string; token: string; canSpeak: boolean; speaker: boolean } | null>(null);

  // A call that connects takes you out of your room (the server already removed you)
  useEffect(() => {
    const current = useRoomStore.getState().room;
    if (call.phase === 'connected' && current) useRoomStore.getState().onExit(current.id, 'call');
  }, [call.phase]);

  // Join when a session with voice starts, leave when it ends
  const hasCredentials = Boolean(credentials);
  useEffect(() => {
    if (!sessionKey) {
      useVoiceStore.setState(initialVoiceState);
      return;
    }
    const { credentials: creds, muted: startMuted, speaker: startSpeaker, kind: k, sessionId: id } = latest.current;
    if (!creds) {
      useVoiceStore.setState({ ...initialVoiceState, message: NOT_CONFIGURED });
      return;
    }

    const key = sessionKey;
    const isCurrent = () => joined.current?.key === key;
    let notice: string | undefined;
    const listener: VoiceListener = {
      onStatus: (status: VoiceStatus, message?: string) => {
        if (!isCurrent()) return;
        if (message) notice = message;
        useVoiceStore.setState({ status, message: notice ?? (status === 'failed' ? FAILED : null) });
      },
      onRemoteUsers: (uids) => isCurrent() && useVoiceStore.setState({ remoteUids: uids }),
      onSpeaking: (uids) => isCurrent() && useVoiceStore.setState({ speakingUids: uids }),
      onTokenWillExpire: () =>
        enqueue(async () => {
          if (!isCurrent() || !id) return;
          const fresh = k === 'call' ? await api.calls.getVoice(id) : await api.rooms.getVoice(id);
          if (fresh && isCurrent()) {
            joined.current = { ...joined.current!, token: fresh.token };
            await voiceEngine.renewToken(fresh.token);
          }
        }),
    };

    joined.current = { key, token: creds.token, canSpeak: creds.canSpeak, speaker: startSpeaker };
    useVoiceStore.setState({ ...initialVoiceState, status: 'connecting' });
    enqueue(() => voiceEngine.join(creds, { canSpeak: creds.canSpeak, muted: startMuted, speaker: startSpeaker }, listener));

    return () => {
      joined.current = null;
      enqueue(() => voiceEngine.leave());
      useVoiceStore.setState(initialVoiceState);
    };
  }, [sessionKey, hasCredentials]);

  // New credentials in the same session: your room role changed (speaker ↔ audience)
  useEffect(() => {
    const j = joined.current;
    if (!credentials || !j || j.key !== sessionKey || j.token === credentials.token) return;
    joined.current = { ...j, token: credentials.token, canSpeak: credentials.canSpeak };
    if (credentials.canSpeak !== j.canSpeak) enqueue(() => voiceEngine.setCanSpeak(credentials.canSpeak, credentials));
    else enqueue(() => voiceEngine.renewToken(credentials.token));
  }, [credentials, sessionKey]);

  useEffect(() => {
    if (joined.current?.key === sessionKey) enqueue(() => voiceEngine.setMuted(muted));
  }, [muted, sessionKey]);

  useEffect(() => {
    const j = joined.current;
    if (!j || j.key !== sessionKey || j.speaker === speaker) return;
    joined.current = { ...j, speaker };
    enqueue(() => voiceEngine.setSpeaker(speaker));
  }, [speaker, sessionKey]);

  return null;
}
