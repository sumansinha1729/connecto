import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { IconButton } from './IconButton';
import { Text } from './Text';
import { goBack } from '@/utils/navigation';

interface HeaderProps {
  title?: string;
  /** Show a back (or close) button on the left */
  back?: 'back' | 'close' | false;
  onBack?: () => void;
  right?: ReactNode;
}

export function Header({ title, back = 'back', onBack, right }: HeaderProps) {
  const handleBack = onBack ?? (goBack);

  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {back && (
          <IconButton
            icon={back === 'close' ? 'close' : 'chevron-back'}
            onPress={handleBack}
            size={40}
            background="transparent"
            accessibilityLabel={back === 'close' ? 'Close' : 'Go back'}
          />
        )}
      </View>
      <Text variant="heading" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bg,
  },
  side: { minWidth: 56, alignItems: 'flex-start' },
  right: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
});
