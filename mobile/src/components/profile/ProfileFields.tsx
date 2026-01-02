import { StyleSheet, View } from 'react-native';

import { TextField } from '@/components/ui';
import { GENDER_OPTIONS, INTERESTS, LANGUAGES } from '@/constants/options';
import { spacing } from '@/theme';
import type { Gender } from '@/types';
import { ChipSelect } from './ChipSelect';
import type { ProfileDraft } from './profileDraft';

interface FieldsProps {
  draft: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
}

export function BasicInfoFields({ draft, onChange, showAge = true }: FieldsProps & { showAge?: boolean }) {
  return (
    <View style={styles.section}>
      <TextField
        label="Nickname"
        placeholder="What should people call you?"
        value={draft.name}
        onChangeText={(name) => onChange({ name })}
        maxLength={20}
        autoCapitalize="words"
        hint="Use a nickname if you want to stay anonymous."
      />
      {showAge && (
        <TextField
          label="Age"
          placeholder="18"
          value={draft.age}
          onChangeText={(age) => onChange({ age: age.replace(/\D/g, '') })}
          keyboardType="number-pad"
          maxLength={2}
        />
      )}
      <ChipSelect
        label="Gender"
        options={GENDER_OPTIONS}
        selected={draft.gender ? [draft.gender] : []}
        onChange={([gender]) => onChange({ gender: gender as Gender })}
        multiple={false}
      />
    </View>
  );
}

export function PreferenceFields({ draft, onChange }: FieldsProps) {
  return (
    <View style={styles.section}>
      <ChipSelect
        label="Languages you speak"
        options={LANGUAGES}
        selected={draft.languages}
        onChange={(languages) => onChange({ languages })}
        max={4}
      />
      <ChipSelect
        label="What do you want to talk about?"
        options={INTERESTS}
        selected={draft.interests}
        onChange={(interests) => onChange({ interests })}
        max={5}
      />
      <TextField
        label="About you (optional)"
        placeholder="A line about yourself"
        value={draft.bio}
        onChangeText={(bio) => onChange({ bio })}
        maxLength={120}
        multiline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xl },
});
