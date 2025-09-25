import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { formatCoins } from '@/utils/format';
import { Icon } from './Icon';
import { Text } from './Text';

interface CoinBadgeProps {
  amount: number;
  onPress?: () => void;
}

export function CoinBadge({ amount, onPress }: CoinBadgeProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${amount} coins. Recharge`}
      style={({ pressed }) => [styles.badge, pressed && { opacity: 0.8 }]}
    >
      <Icon name="logo-bitcoin" size={16} color={colors.coin} />
      <Text variant="bodyStrong" color="coin">
        {formatCoins(amount)}
      </Text>
      {onPress && <Icon name="add-circle" size={18} color={colors.primary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
