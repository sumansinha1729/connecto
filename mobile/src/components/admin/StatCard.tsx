import { StyleSheet, View } from 'react-native';

import { Card, Icon, Text, type IconName } from '@/components/ui';
import { colors, spacing } from '@/theme';

interface StatCardProps {
  icon: IconName;
  label: string;
  value: string | number;
  sub?: string;
  /** Highlight when something needs attention */
  alert?: boolean;
  onPress?: () => void;
}

export function StatCard({ icon, label, value, sub, alert, onPress }: StatCardProps) {
  return (
    <Card onPress={onPress} style={[styles.card, alert && styles.alert]}>
      <View style={styles.top}>
        <Icon name={icon} size={16} color={alert ? colors.warning : colors.primary} />
        <Text variant="caption" color="muted" numberOfLines={1} style={styles.label}>
          {label}
        </Text>
        {onPress && <Icon name="chevron-forward" size={14} color={colors.textFaint} />}
      </View>
      <Text variant="title">{value}</Text>
      {sub && (
        <Text variant="caption" color="faint" numberOfLines={1}>
          {sub}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexBasis: '47%', flexGrow: 1, gap: spacing.xs, padding: spacing.md },
  alert: { borderColor: colors.warning },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { flex: 1 },
});
