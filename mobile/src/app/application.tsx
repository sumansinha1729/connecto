import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ApplicationSummary } from '@/components/listener/ApplicationSummary';
import { Button, Card, Icon, Screen, Text } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';
import { confirm, notify } from '@/utils/dialog';
import { getErrorMessage } from '@/utils/errors';

/**
 * Where people who chose "become a listener" at signup wait for review.
 * Approval updates this live (the server sends `account:updated`) and opens the listener app.
 */
export default function ApplicationStatusScreen() {
  const user = useAuthStore((s) => s.user)!;
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const setIntent = useAuthStore((s) => s.setIntent);
  const logout = useAuthStore((s) => s.logout);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const app = user.listenerApplication;
  const rejected = user.listenerStatus === 'rejected';

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshMe();
    setRefreshing(false);
  };

  const continueAsUser = async () => {
    const ok = await confirm({
      title: 'Continue as a normal user?',
      message: 'You can talk to listeners and apply again later from your profile.',
      confirmText: 'Continue',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await setIntent('user');
      router.replace('/');
    } catch (e) {
      notify('Something went wrong', getErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Screen
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      footer={
        <View style={styles.footer}>
          {rejected ? (
            <>
              <Button title="Fix and re-apply" icon="create-outline" onPress={() => router.push({ pathname: '/listener-apply', params: { edit: '1' } })} />
              <Button title="Continue as a normal user" variant="secondary" onPress={continueAsUser} loading={busy} />
            </>
          ) : (
            <Button title="Edit application" variant="secondary" icon="create-outline" onPress={() => router.push({ pathname: '/listener-apply', params: { edit: '1' } })} />
          )}
          <Button title="Log out" variant="ghost" size="sm" onPress={logout} />
        </View>
      }
    >
      <View style={styles.hero}>
        <View style={[styles.statusIcon, rejected && styles.statusIconRejected]}>
          <Icon name={rejected ? 'close-circle' : 'hourglass'} size={40} color={rejected ? colors.danger : colors.warning} />
        </View>
        <Text variant="title" center>
          {rejected ? 'Not approved this time' : 'Application under review'}
        </Text>
        <Text variant="body" color="muted" center>
          {rejected
            ? 'You can fix your application and send it again, or use Connecto as a normal user.'
            : 'Our team usually reviews applications within 24 hours. This screen updates as soon as you’re approved.'}
        </Text>
      </View>

      {rejected && app.note && (
        <Card style={styles.reason}>
          <Text variant="label" color="danger">
            Reason
          </Text>
          <Text variant="body">{app.note}</Text>
        </Card>
      )}

      <ApplicationSummary user={user} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  statusIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  statusIconRejected: { backgroundColor: colors.dangerSoft },
  reason: { gap: spacing.xs, marginBottom: spacing.lg, borderColor: colors.danger },
  footer: { gap: spacing.sm },
});
