import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform, Vibration } from 'react-native';

import { useCallStore } from '@/store/callStore';
import { useVoiceStore } from '@/store/voiceStore';

/** Ringing longer than the server's ring timeout (30 s) means we missed how it ended */
const RING_CHECK_MS = 40_000;
/** During a call, check with the server this often in case "call ended" was missed */
const CONNECTED_CHECK_MS = 30_000;
/** No sound from the other person for this long: hang up, so nobody pays for silence */
const NO_AUDIO_MS = 45_000;

/**
 * Mounted once at the root. Opens the call screen when a call comes in (or is restored from the
 * server), vibrates while it rings, and keeps the call honest: it resyncs with the server and
 * hangs up when the audio never connects.
 */
export function CallManager() {
  const phase = useCallStore((s) => s.phase);
  const callId = useCallStore((s) => s.callId);
  const restoredAt = useCallStore((s) => s.restoredAt);
  const hasVoice = useCallStore((s) => Boolean(s.voice));
  const peerHeard = useVoiceStore((s) => s.remoteUids.length > 0);
  const voiceStatus = useVoiceStore((s) => s.status);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (phase === 'incoming' && pathnameRef.current !== '/call') router.push('/call');
  }, [phase]);

  // A call brought back from the server (app reopened mid-call): show it
  useEffect(() => {
    if (restoredAt && pathnameRef.current !== '/call') router.push('/call');
  }, [restoredAt]);

  useEffect(() => {
    if (phase !== 'incoming' || Platform.OS === 'web') return;
    Vibration.vibrate([0, 800, 1200], true);
    return () => Vibration.cancel();
  }, [phase]);

  // Missed events: ringing for too long, or a call the server may have ended
  useEffect(() => {
    if (!callId) return;
    const sync = () => useCallStore.getState().syncWithServer();
    if (phase === 'incoming' || phase === 'outgoing') {
      const id = setTimeout(sync, RING_CHECK_MS);
      return () => clearTimeout(id);
    }
    if (phase === 'connected') {
      const id = setInterval(sync, CONNECTED_CHECK_MS);
      return () => clearInterval(id);
    }
  }, [phase, callId]);

  // The other person's audio never arrived (or dropped for good): hang up instead of billing silence.
  // Skipped without voice (Agora not set up) and in Expo Go, where there is no audio at all.
  useEffect(() => {
    if (phase !== 'connected' || !hasVoice || peerHeard || voiceStatus === 'unavailable') return;
    const id = setTimeout(() => useCallStore.getState().hangup('no_audio'), NO_AUDIO_MS);
    return () => clearTimeout(id);
  }, [phase, callId, hasVoice, peerHeard, voiceStatus]);

  return null;
}
