import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

export function ListenerBadge() {
  return (
    <View style={styles.badge}>
      <Icon name="ribbon" size={11} color={colors.primary} />
      <Text variant="caption" color="primary" style={styles.text}>
        Listener
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
  },
  text: { fontSize: 11, fontWeight: '700' },
});
