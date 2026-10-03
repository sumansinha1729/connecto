import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, StarRating, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { CallRecord } from '@/types';
import { formatShortDuration } from '@/utils/format';

const LABELS = ['', 'Not good', 'Could be better', 'Okay', 'Good', 'Great!'];

interface RateCallSheetProps {
  call: CallRecord | null;
  onSubmit: (call: CallRecord, stars: number) => Promise<void>;
  onClose: () => void;
}

/** Bottom sheet to rate a past call from the history */
export function RateCallSheet({ call, onSubmit, onClose }: RateCallSheetProps) {
  const insets = useSafeAreaInsets();
  const [stars, setStars] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStars(0);
    setSaving(false);
  }, [call?.id]);

  const submit = async () => {
    if (!call || !stars) return;
    setSaving(true);
    try {
      await onSubmit(call, stars);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={call !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      {call && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />
          <Avatar avatar={call.peer.avatar} size={64} />
          <Text variant="heading" center>
            How was your talk with {call.peer.name}?
          </Text>
          <Text variant="caption" color="muted" center>
            {formatShortDuration(call.durationSec)} · your rating helps others find good listeners
          </Text>
          <StarRating value={stars} onChange={setStars} size={40} />
          <Text variant="bodyStrong" style={styles.label}>
            {LABELS[stars] || ' '}
          </Text>
          <Button title="Submit rating" onPress={submit} loading={saving} disabled={!stars} style={styles.button} />
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  label: { color: colors.coin, minHeight: 20 },
  button: { alignSelf: 'stretch' },
});
