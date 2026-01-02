import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui';
import { GENDER_OPTIONS, LANGUAGES } from '@/constants/options';
import { colors, spacing } from '@/theme';
import type { UserFilters } from '@/types';

interface FilterBarProps {
  value: UserFilters;
  onChange: (value: UserFilters) => void;
  /** Languages to show first (usually the user's own) */
  preferredLanguages?: string[];
}

export function FilterBar({ value, onChange, preferredLanguages = [] }: FilterBarProps) {
  const languages = [...preferredLanguages, ...LANGUAGES.filter((l) => !preferredLanguages.includes(l))];
  const set = (patch: Partial<UserFilters>) => onChange({ ...value, ...patch });

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Chip label="Online" icon="radio-button-on" selected={Boolean(value.onlineOnly)} onPress={() => set({ onlineOnly: !value.onlineOnly })} />
      <View style={styles.divider} />
      {GENDER_OPTIONS.filter((g) => g.value !== 'other').map((g) => (
        <Chip
          key={g.value}
          label={g.label}
          selected={value.gender === g.value}
          onPress={() => set({ gender: value.gender === g.value ? null : g.value })}
        />
      ))}
      <View style={styles.divider} />
      {languages.map((language) => (
        <Chip
          key={language}
          label={language}
          selected={value.language === language}
          onPress={() => set({ language: value.language === language ? null : language })}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: 'center' },
  divider: { width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: spacing.xs },
});
