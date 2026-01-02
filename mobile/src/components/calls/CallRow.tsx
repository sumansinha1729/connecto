import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Icon, IconButton, Text, type IconName } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { CallRecord } from '@/types';
import { formatCoins, formatRelativeTime, formatRupees, formatShortDuration } from '@/utils/format';

function describe(call: CallRecord): { icon: IconName; color: string; label: string } {
  const outgoing = call.direction === 'outgoing';
  switch (call.status) {
    case 'completed':
      return {
        icon: outgoing ? 'arrow-up' : 'arrow-down',
        color: colors.success,
        label: formatShortDuration(call.durationSec),
      };
    case 'missed':
      return outgoing
        ? { icon: 'arrow-up', color: colors.textFaint, label: 'No answer' }
        : { icon: 'arrow-down', color: colors.danger, label: 'Missed' };
    case 'rejected':
      return { icon: outgoing ? 'arrow-up' : 'arrow-down', color: colors.danger, label: outgoing ? 'Declined' : 'You declined' };
    case 'cancelled':
      return { icon: 'arrow-up', color: colors.textFaint, label: 'Cancelled' };
  }
}

interface CallRowProps {
  call: CallRecord;
  onPress: () => void;
  /** Omit to hide the call-back button (listeners can't place calls) */
  onCallBack?: () => void;
}

export function CallRow({ call, onPress, onCallBack }: CallRowProps) {
  const { icon, color, label } = describe(call);
  const amount =
    call.direction === 'outgoing'
      ? call.coins > 0
        ? { text: formatCoins(-call.coins, true), color: colors.textMuted }
        : null
      : call.earnedPaise > 0
        ? { text: formatRupees(call.earnedPaise, true), color: colors.success }
        : null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
      <Avatar avatar={call.peer.avatar} size={48} />
      <View style={styles.info}>
        <Text variant="bodyStrong" numberOfLines={1} style={call.status === 'missed' && call.direction === 'incoming' ? { color: colors.danger } : null}>
          {call.peer.name}
        </Text>
        <View style={styles.meta}>
          <Icon name={icon} size={14} color={color} />
          <Text variant="caption" color="muted">
            {label} · {formatRelativeTime(call.startedAt)}
          </Text>
        </View>
      </View>
      {amount && (
        <Text variant="caption" style={{ color: amount.color, fontWeight: '600' }}>
          {amount.text}
        </Text>
      )}
      {onCallBack && (
        <IconButton
          icon="call"
          size={40}
          color={colors.success}
          background={colors.successSoft}
          onPress={onCallBack}
          accessibilityLabel={`Call ${call.peer.name}`}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  info: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
