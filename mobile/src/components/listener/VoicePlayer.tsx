import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { StyleSheet, View } from 'react-native';

import { IconButton, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { formatDuration } from '@/utils/format';

interface VoicePlayerProps {
  uri: string;
  /** Shown until the player knows the real length (e.g. WebM files on Chrome) */
  fallbackDurationSec?: number | null;
}

/** Play/pause + progress for one recording. Render with `key={uri}` to switch recordings. */
export function VoicePlayer({ uri, fallbackDurationSec }: VoicePlayerProps) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const duration = status.duration > 0 && Number.isFinite(status.duration) ? status.duration : (fallbackDurationSec ?? 0);
  const progress = duration > 0 ? Math.min(1, status.currentTime / duration) : 0;

  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (duration > 0 && status.currentTime >= duration - 0.2)) player.seekTo(0);
    player.play();
  };

  return (
    <View style={styles.row}>
      <IconButton
        icon={status.playing ? 'pause' : 'play'}
        onPress={toggle}
        size={44}
        color={colors.white}
        background={colors.primary}
        accessibilityLabel={status.playing ? 'Pause voice intro' : 'Play voice intro'}
      />
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <Text variant="caption" color="muted" style={styles.time}>
        {formatDuration(status.currentTime)} / {formatDuration(duration)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  track: { flex: 1, height: 6, borderRadius: radius.full, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary },
  time: { fontVariant: ['tabular-nums'] },
});
