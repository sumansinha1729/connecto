import { StyleSheet, View } from 'react-native';

import { Chip, Text } from '@/components/ui';
import { spacing } from '@/theme';

type Option = string | { value: string; label: string };

interface ChipSelectProps {
  label?: string;
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  multiple?: boolean;
  max?: number;
}

export function ChipSelect({ label, options, selected, onChange, multiple = true, max }: ChipSelectProps) {
  const toggle = (value: string) => {
    if (!multiple) return onChange([value]);
    if (selected.includes(value)) return onChange(selected.filter((v) => v !== value));
    if (max && selected.length >= max) return;
    onChange([...selected, value]);
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text variant="label" color="muted">
          {label}
          {max ? `  ·  up to ${max}` : ''}
        </Text>
      )}
      <View style={styles.wrap}>
        {options.map((option) => {
          const { value, label: text } = typeof option === 'string' ? { value: option, label: option } : option;
          return <Chip key={value} label={text} selected={selected.includes(value)} onPress={() => toggle(value)} />;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
