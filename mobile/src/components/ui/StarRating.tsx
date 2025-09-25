import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { Icon } from './Icon';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
}

export function StarRating({ value, onChange, size = 36 }: StarRatingProps) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => onChange?.(star)}
          disabled={!onChange}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
        >
          <Icon name={star <= value ? 'star' : 'star-outline'} size={size} color={star <= value ? colors.coin : colors.textFaint} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
});
