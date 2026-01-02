import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { VOICE_INTRO_MAX_SEC, VOICE_INTRO_MIN_SEC } from '@/constants/config';
import { colors, radius, spacing } from '@/theme';
import { getErrorMessage } from '@/utils/errors';
import { formatDuration } from '@/utils/format';
import { VoicePlayer } from './VoicePlayer';

interface VoiceRecorderProps {
  /** Already-uploaded intro, if any */
  savedUrl: string | null;
  savedDurationSec: number | null;
  /** Uploads the recording; throw to show an error */
  onSave: (uri: string, durationSec: number) => Promise<void>;
}

type Phase = 'idle' | 'starting' | 'recording' | 'review' | 'saving';

/**
 * Record → listen back → save. Stops automatically at the maximum length and
 * refuses recordings shorter than the minimum.
 */
export function VoiceRecorder({ savedUrl, savedDurationSec, onSave }: VoiceRecorderProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<Phase>('idle');
  const [take, setTake] = useState<{ uri: string; durationSec: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(0);

  const elapsedSec = phase === 'recording' ? Math.max(state.durationMillis / 1000, (Date.now() - startedAt.current) / 1000) : 0;

  const start = async () => {
    setError(null);
    // Opening the microphone can take a few seconds the first time
    setPhase('starting');
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Allow microphone access to record your voice intro.');
        setPhase('idle');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      setTake(null);
      setPhase('recording');
    } catch (e) {
      setError(getErrorMessage(e));
      setPhase('idle');
    }
  };

  const stopping = useRef(false);
  const stop = async () => {
    if (stopping.current) return;
    stopping.current = true;
    const durationSec = Math.round(Math.max(state.durationMillis / 1000, (Date.now() - startedAt.current) / 1000));
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
    } catch (e) {
      setError(getErrorMessage(e));
    }
    stopping.current = false;
    const uri = recorder.uri;
    if (!uri) {
      setPhase('idle');
      setError('Recording failed. Please try again.');
      return;
    }
    if (durationSec < VOICE_INTRO_MIN_SEC) {
      setPhase('idle');
      setError(`That was ${durationSec}s. Please talk for at least ${VOICE_INTRO_MIN_SEC} seconds.`);
      return;
    }
    setTake({ uri, durationSec: Math.min(durationSec, VOICE_INTRO_MAX_SEC) });
    setPhase('review');
  };

  // Stop automatically at the maximum length
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => {
    if (phase === 'recording' && elapsedSec >= VOICE_INTRO_MAX_SEC) stopRef.current();
  }, [phase, elapsedSec]);

  const save = async () => {
    if (!take) return;
    setPhase('saving');
    setError(null);
    try {
      await onSave(take.uri, take.durationSec);
      setTake(null);
      setPhase('idle');
    } catch (e) {
      setError(getErrorMessage(e));
      setPhase('review');
    }
  };

  return (
    <View style={styles.container}>
      {phase === 'recording' ? (
        <Card style={styles.recording}>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text variant="bodyStrong">Recording</Text>
            <Text variant="heading" style={styles.timer}>
              {formatDuration(elapsedSec)}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.minMark, { left: `${(VOICE_INTRO_MIN_SEC / VOICE_INTRO_MAX_SEC) * 100}%` }]} />
            <View style={[styles.fill, { width: `${Math.min(1, elapsedSec / VOICE_INTRO_MAX_SEC) * 100}%` }]} />
          </View>
          <Text variant="caption" color="muted">
            {elapsedSec < VOICE_INTRO_MIN_SEC
              ? `Keep going: at least ${Math.ceil(VOICE_INTRO_MIN_SEC - elapsedSec)}s more`
              : `Looks good. Stops automatically at ${VOICE_INTRO_MAX_SEC}s`}
          </Text>
          <Button title="Stop" icon="stop" variant="danger" onPress={stop} />
        </Card>
      ) : take ? (
        <Card style={styles.card}>
          <Text variant="bodyStrong">Listen back</Text>
          <VoicePlayer key={take.uri} uri={take.uri} fallbackDurationSec={take.durationSec} />
          <View style={styles.actions}>
            <Button title="Record again" variant="secondary" size="sm" icon="refresh" onPress={start} style={styles.flex} />
            <Button title="Use this" size="sm" icon="checkmark" onPress={save} loading={phase === 'saving'} style={styles.flex} />
          </View>
        </Card>
      ) : (
        <>
          {savedUrl && (
            <Card style={styles.card}>
              <View style={styles.savedRow}>
                <Icon name="checkmark-circle" size={18} color={colors.success} />
                <Text variant="bodyStrong">Your voice intro is saved</Text>
              </View>
              <VoicePlayer key={savedUrl} uri={savedUrl} fallbackDurationSec={savedDurationSec} />
            </Card>
          )}
          <Button
            title={savedUrl ? 'Record a new one' : 'Start recording'}
            icon="mic"
            variant={savedUrl ? 'secondary' : 'primary'}
            onPress={start}
            loading={phase === 'starting'}
          />
        </>
      )}
      {error && (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  card: { gap: spacing.md },
  recording: { gap: spacing.md, borderColor: colors.danger },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  timer: { marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: radius.full, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.danger },
  minMark: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.textMuted, zIndex: 1 },
  actions: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
