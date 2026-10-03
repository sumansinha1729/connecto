import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApplicationSteps } from '@/components/listener/ApplicationSteps';
import { ApplicationSummary } from '@/components/listener/ApplicationSummary';
import { Button, Header, Icon, Screen, Text } from '@/components/ui';
import { selectIsPendingApplicant, useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';
import { confirm, notify } from '@/utils/dialog';
import { getErrorMessage } from '@/utils/errors';
import { goBack } from '@/utils/navigation';

/**
 * Apply to become a listener (from Profile). If an application is already
 * waiting for review, show it with "Edit" / "Withdraw" instead of the form.
 * `?edit=1` opens the form straight away (used by the review screen).
 */
export default function ListenerApplyScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const user = useAuthStore((s) => s.user)!;
  const isSignupApplicant = useAuthStore(selectIsPendingApplicant);
  const setIntent = useAuthStore((s) => s.setIntent);
  const [editing, setEditing] = useState(edit === '1');
  const [withdrawing, setWithdrawing] = useState(false);

  const pending = user.listenerStatus === 'pending';

  if (!pending || editing) {
    return (
      <ApplicationSteps
        exitLabel="close"
        // Back from the form: return to the summary if we came from it
        onExit={() => (pending && editing && edit !== '1' ? setEditing(false) : goBack())}
        onSubmitted={(updated) => {
          notify(
            pending ? 'Application updated' : 'Application sent',
            'Our team will review it, usually within 24 hours.',
          );
          if (updated.listenerStatus === 'pending' && edit !== '1') setEditing(false);
          else goBack();
        }}
      />
    );
  }

  const withdraw = async () => {
    const ok = await confirm({
      title: 'Withdraw your application?',
      message: 'Our team won’t review it. You can apply again any time.',
      confirmText: 'Withdraw',
      destructive: true,
    });
    if (!ok) return;
    setWithdrawing(true);
    try {
      await setIntent('user');
      goBack();
    } catch (e) {
      notify('Couldn’t withdraw', getErrorMessage(e));
      setWithdrawing(false);
    }
  };

  return (
    <Screen
      scroll
      padded={false}
      footer={
        <View style={styles.footer}>
          <Button title="Edit application" icon="create-outline" variant="secondary" onPress={() => setEditing(true)} />
          {/* People who chose "listener" at signup withdraw from the review screen instead */}
          {!isSignupApplicant && (
            <Button title="Withdraw application" variant="ghost" size="sm" onPress={withdraw} loading={withdrawing} />
          )}
        </View>
      }
    >
      <Header title="Listener application" back="close" />
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.statusIcon}>
            <Icon name="hourglass" size={36} color={colors.warning} />
          </View>
          <Text variant="title" center>
            Under review
          </Text>
          <Text variant="body" color="muted" center>
            Our team usually reviews applications within 24 hours. You can keep using the app meanwhile.
          </Text>
        </View>
        <ApplicationSummary user={user} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg },
  statusIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningSoft,
  },
  footer: { gap: spacing.sm, paddingHorizontal: spacing.lg },
});
