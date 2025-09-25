import { router } from 'expo-router';
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
import { colors, radius, spacing } from '@/theme';
import { getErrorMessage } from '@/utils/errors';

const STEPS = [
  { title: 'Pick your avatar', subtitle: 'This is how others will see you.' },
  { title: 'About you', subtitle: 'Only your nickname, age and gender are shown.' },
  { title: 'Your vibe', subtitle: 'We use this to match you with the right people.' },
];

export default function OnboardingScreen() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const logout = useAuthStore((s) => s.logout);

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromUser(user!));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const change = (patch: Partial<ProfileDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  };

  const next = async () => {
    const validation = step === 1 ? validateBasics(draft) : step === 2 ? validatePreferences(draft) : null;
    if (validation) return setError(validation);
    if (step < STEPS.length - 1) return setStep(step + 1);

    setSaving(true);
    try {
      await updateProfile(draftToUpdate(draft));
      router.replace('/');
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
          <Button title={step === STEPS.length - 1 ? 'Start talking' : 'Continue'} onPress={next} loading={saving} />
        </View>
      }
    >
      <Header
        back={step > 0 ? 'back' : false}
        onBack={() => setStep(step - 1)}
        right={
          step === 0 ? <Button title="Log out" variant="ghost" size="sm" onPress={logout} /> : undefined
        }
      />
      <View style={styles.content}>
        <View style={styles.progress}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.progressBar, i <= step && styles.progressActive]} />
          ))}
        </View>

        <View style={styles.titles}>
          <Text variant="title">{STEPS[step].title}</Text>
          <Text variant="body" color="muted">
            {STEPS[step].subtitle}
          </Text>
        </View>

        {step === 0 && <AvatarPicker value={draft.avatar} onChange={(avatar) => change({ avatar })} />}
        {step === 1 && <BasicInfoFields draft={draft} onChange={change} />}
        {step === 2 && <PreferenceFields draft={draft} onChange={change} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  progress: { flexDirection: 'row', gap: spacing.sm },
  progressBar: { flex: 1, height: 4, borderRadius: radius.full, backgroundColor: colors.border },
  progressActive: { backgroundColor: colors.primary },
  titles: { gap: spacing.xs },
  footer: { gap: spacing.sm, paddingHorizontal: spacing.lg },
});
