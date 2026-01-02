import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

const TONES = {
  active: { bg: colors.successSoft, fg: colors.success },
  banned: { bg: colors.dangerSoft, fg: colors.danger },
  deleted: { bg: colors.surfaceAlt, fg: colors.textFaint },
  pending: { bg: 'rgba(245, 158, 11, 0.16)', fg: colors.warning },
  listener: { bg: colors.primarySoft, fg: colors.primary },
} as const;

export function StatusBadge({ label, tone }: { label: string; tone: keyof typeof TONES }) {
  return (
    <View style={[styles.badge, { backgroundColor: TONES[tone].bg }]}>
      <Text variant="caption" style={[styles.text, { color: TONES[tone].fg }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  text: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
});
