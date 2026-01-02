import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AvatarPicker } from '@/components/profile/AvatarPicker';
import { BasicInfoFields, PreferenceFields } from '@/components/profile/ProfileFields';
import {
  draftFromUser,
  draftToUpdate,
  validateBasics,
  validatePreferences,
  type ProfileDraft,
} from '@/components/profile/profileDraft';
import { Button, Header, Screen, Text } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { spacing } from '@/theme';
import { getErrorMessage } from '@/utils/errors';
import { goBack } from '@/utils/navigation';

export default function EditProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromUser(user!));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const change = (patch: Partial<ProfileDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  };

  const save = async () => {
    const validation = validateBasics(draft) ?? validatePreferences(draft);
    if (validation) return setError(validation);
    setSaving(true);
    try {
      await updateProfile(draftToUpdate(draft));
      goBack();
    } catch (e) {
      setError(getErrorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Screen
      scroll
      keyboard
      padded={false}
      footer={
        <View style={styles.footer}>
          {error && (
            <Text variant="caption" color="danger" center>
              {error}
            </Text>
          )}
          <Button title="Save changes" onPress={save} loading={saving} />
        </View>
      }
    >
      <Header title="Edit profile" />
      <View style={styles.content}>
        <AvatarPicker value={draft.avatar} onChange={(avatar) => change({ avatar })} />
        <BasicInfoFields draft={draft} onChange={change} />
        <PreferenceFields draft={draft} onChange={change} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.xxl },
  footer: { gap: spacing.sm, paddingHorizontal: spacing.lg },
});
