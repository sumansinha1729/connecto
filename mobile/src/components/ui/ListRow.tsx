import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

interface ListRowProps {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  /** Custom element on the right, replaces the chevron */
  right?: ReactNode;
}

export function ListRow({ icon, label, value, onPress, danger, right }: ListRowProps) {
  const tint = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
    >
      <View style={[styles.iconWrap, danger && { backgroundColor: colors.dangerSoft }]}>
        <Icon name={icon} size={18} color={danger ? colors.danger : colors.primary} />
      </View>
      <Text variant="bodyStrong" style={[styles.label, { color: tint }]}>
        {label}
      </Text>
      {value && (
        <Text variant="caption" color="muted">
          {value}
        </Text>
      )}
      {right ?? (onPress && <Icon name="chevron-forward" size={18} color={colors.textFaint} />)}
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
    minHeight: 56,
    borderRadius: radius.md,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
});
