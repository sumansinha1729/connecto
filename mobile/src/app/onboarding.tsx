import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApplicationSteps } from '@/components/listener/ApplicationSteps';
import { RoleChoice } from '@/components/onboarding/RoleChoice';
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

type Path = 'user' | 'listener';

const PROFILE_STEPS = [
  { key: 'avatar', title: 'Pick your avatar', subtitle: 'This is how others will see you.' },
  { key: 'basics', title: 'About you', subtitle: 'Only your nickname, age and gender are shown.' },
  { key: 'prefs', title: 'Your vibe', subtitle: 'We use this to match you with the right people.' },
] as const;

/**
 * New accounts: choose a path, set up the public profile, and (listeners only)
 * fill in the application that an admin reviews.
 */
export default function OnboardingScreen() {
  const user = useAuthStore((s) => s.user)!;
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const setIntent = useAuthStore((s) => s.setIntent);
  const logout = useAuthStore((s) => s.logout);

  const [path, setPath] = useState<Path | null>(user.signupIntent === 'listener' ? 'listener' : null);
  const [step, setStep] = useState(0);
  const [inApplication, setInApplication] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromUser(user));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isListenerPath = path === 'listener';

  const choose = async (role: Path) => {
    setBusy(true);
    setError(null);
    try {
      if (role !== user.signupIntent) await setIntent(role);
      setPath(role);
      setStep(0);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  /** Back from the first profile step: choose again (undoing a "listener" choice) */
  const backToChoice = async () => {
    try {
      if (useAuthStore.getState().user?.signupIntent === 'listener') await setIntent('user');
      setPath(null);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const change = (patch: Partial<ProfileDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  };

  const next = async () => {
    const key = PROFILE_STEPS[step].key;
    const problem =
      key === 'basics' ? validateBasics(draft, { requireAge: !isListenerPath }) : key === 'prefs' ? validatePreferences(draft) : null;
    if (problem) return setError(problem);
    if (step < PROFILE_STEPS.length - 1) return setStep(step + 1);

    setBusy(true);
    try {
      await updateProfile(draftToUpdate(draft, { includeAge: !isListenerPath }));
      if (isListenerPath) setInApplication(true);
      else router.replace('/');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Listener path, part 2: the application itself
  if (isListenerPath && inApplication) {
    return (
      <ApplicationSteps
        onExit={() => setInApplication(false)}
        onSubmitted={() => router.replace('/application')}
      />
    );
  }

  // First screen: choose a path
  if (!path) {
    return (
      <Screen scroll padded={false}>
        <Header back={false} right={<Button title="Log out" variant="ghost" size="sm" onPress={logout} />} />
        <View style={styles.content}>
          <View style={styles.titles}>
            <Text variant="title">Welcome to Connecto</Text>
            <Text variant="body" color="muted">
              How would you like to use the app?
            </Text>
          </View>
          <RoleChoice onChoose={choose} disabled={busy} />
          {error && (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          )}
          <Text variant="caption" color="faint" center>
            One account is either a user or a listener. You can also apply to become a listener later.
          </Text>
        </View>
      </Screen>
    );
  }

  const current = PROFILE_STEPS[step];
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
          <Button
            title={step === PROFILE_STEPS.length - 1 ? (isListenerPath ? 'Continue to application' : 'Start talking') : 'Continue'}
            onPress={next}
            loading={busy}
          />
        </View>
      }
    >
      <Header back="back" onBack={() => (step > 0 ? setStep(step - 1) : backToChoice())} />
      <View style={styles.content}>
        {isListenerPath && (
          <View style={styles.badge}>
            <Text variant="caption" color="primary" style={styles.badgeText}>
              Listener application · step 1 of 2: your public profile
            </Text>
          </View>
        )}
        <View style={styles.progress}>
          {PROFILE_STEPS.map((s, i) => (
            <View key={s.key} style={[styles.progressBar, i <= step && styles.progressActive]} />
          ))}
        </View>
        <View style={styles.titles}>
          <Text variant="title">{current.title}</Text>
          <Text variant="body" color="muted">
            {isListenerPath && current.key === 'basics' ? 'Your nickname and gender are shown to callers.' : current.subtitle}
          </Text>
        </View>

        {current.key === 'avatar' && <AvatarPicker value={draft.avatar} onChange={(avatar) => change({ avatar })} />}
        {current.key === 'basics' && <BasicInfoFields draft={draft} onChange={change} showAge={!isListenerPath} />}
        {current.key === 'prefs' && <PreferenceFields draft={draft} onChange={change} />}
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
  badge: { alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.primarySoft },
  badgeText: { fontWeight: '700' },
  footer: { gap: spacing.sm, paddingHorizontal: spacing.lg },
});
