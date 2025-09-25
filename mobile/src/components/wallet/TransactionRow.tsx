import { StyleSheet, View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { Transaction, TransactionType } from '@/types';
import { formatCoins, formatRelativeTime } from '@/utils/format';

const ICON: Record<TransactionType, IconName> = {
  signup_bonus: 'gift',
  recharge: 'add-circle',
  call_charge: 'call',
  call_earning: 'cash',
};

export function TransactionRow({ tx }: { tx: Transaction }) {
  const credit = tx.amount > 0;
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: credit ? colors.successSoft : colors.primarySoft }]}>
        <Icon name={ICON[tx.type]} size={18} color={credit ? colors.success : colors.primary} />
      </View>
      <View style={styles.info}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {tx.description}
        </Text>
        <Text variant="caption" color="faint">
          {formatRelativeTime(tx.createdAt)}
        </Text>
      </View>
      <Text variant="bodyStrong" style={{ color: credit ? colors.success : colors.text }}>
        {formatCoins(tx.amount, true)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 2 },
});
