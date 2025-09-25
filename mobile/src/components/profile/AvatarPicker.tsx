import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, Text } from '@/components/ui';
import { generateAvatarOptions } from '@/constants/avatars';
import { colors, spacing } from '@/theme';

interface AvatarPickerProps {
  value: string;
  onChange: (avatar: string) => void;
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  const [options, setOptions] = useState(() => [value, ...generateAvatarOptions(8)]);

  return (
    <View style={styles.container}>
      <View style={styles.preview}>
        <Avatar avatar={value} size={128} />
        <Text variant="caption" color="muted" center>
          Your avatar keeps you anonymous. Nobody sees your real photo.
        </Text>
      </View>

      <View style={styles.grid}>
        {options.map((option) => (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: option === value }}
            accessibilityLabel="Choose this avatar"
            style={[styles.option, option === value && styles.optionSelected]}
          >
            <Avatar avatar={option} size={64} />
          </Pressable>
        ))}
      </View>

      <Button
        title="Generate new avatars"
        icon="sparkles"
        variant="secondary"
        size="sm"
        onPress={() => setOptions([value, ...generateAvatarOptions(8)])}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xl },
  preview: { alignItems: 'center', gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md },
  option: {
    padding: 3,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: { borderColor: colors.primary },
});
