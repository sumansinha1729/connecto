import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Icon, IconButton, Text, type IconName } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { CallRecord } from '@/types';
import { formatCoins, formatRupees, formatShortDuration } from '@/utils/format';

function describe(call: CallRecord): { icon: IconName; color: string; label: string } {
  const outgoing = call.direction === 'outgoing';
  switch (call.status) {
    case 'completed':
      return { icon: outgoing ? 'arrow-up' : 'arrow-down', color: colors.success, label: formatShortDuration(call.durationSec) };
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

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

interface CallRowProps {
  call: CallRecord;
  onPress: () => void;
  /** Omit to hide the call-back button (listeners can't place calls) */
  onCallBack?: () => void;
  /** Shown as a "Rate" button on completed calls you haven't rated yet */
  onRate?: () => void;
}

export function CallRow({ call, onPress, onCallBack, onRate }: CallRowProps) {
  const { icon, color, label } = describe(call);
  const missedByMe = call.status === 'missed' && call.direction === 'incoming';
  const peerFree = call.peer.isOnline && call.peer.isAvailable && !call.peer.isBusy;
  const amount =
    call.direction === 'outgoing'
      ? call.coins > 0
        ? { text: `${formatCoins(-call.coins, true)} coins`, color: colors.textMuted }
        : null
      : call.earnedPaise > 0
        ? { text: formatRupees(call.earnedPaise, true), color: colors.success }
        : null;
  const canRate = Boolean(onRate) && call.status === 'completed' && call.rating === null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
      <Avatar avatar={call.peer.avatar} size={48} online={call.peer.role === 'listener' ? call.peer.isOnline : undefined} />
      <View style={styles.info}>
        <Text variant="bodyStrong" numberOfLines={1} style={missedByMe ? { color: colors.danger } : null}>
          {call.peer.name}
        </Text>
        <View style={styles.meta}>
          <Icon name={icon} size={13} color={color} />
          <Text variant="caption" color="muted" numberOfLines={1}>
            {label} · {timeOf(call.startedAt)}
          </Text>
          {call.rating !== null && (
            <View style={styles.stars}>
              <Icon name="star" size={11} color={colors.coin} />
              <Text variant="caption" style={styles.starsText}>
                {call.rating}
              </Text>
            </View>
          )}
        </View>
        {(amount || canRate) && (
          <View style={styles.extra}>
            {amount && (
              <Text variant="caption" style={{ color: amount.color, fontWeight: '600' }}>
                {amount.text}
              </Text>
            )}
            {canRate && (
              <Pressable onPress={onRate} hitSlop={8} style={styles.rate} accessibilityRole="button" accessibilityLabel={`Rate your call with ${call.peer.name}`}>
                <Icon name="star-outline" size={12} color={colors.coin} />
                <Text variant="caption" style={styles.rateText}>
                  Rate
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
      {onCallBack && (
        <IconButton
          icon="call"
          size={42}
          color={peerFree ? colors.success : colors.textFaint}
          background={peerFree ? colors.successSoft : colors.surfaceAlt}
          onPress={onCallBack}
          accessibilityLabel={peerFree ? `Call ${call.peer.name}` : `${call.peer.name} isn’t available right now`}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  info: { flex: 1, gap: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 4 },
  starsText: { color: colors.coin, fontWeight: '700' },
  extra: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rateText: { color: colors.coin, fontWeight: '700' },
});
