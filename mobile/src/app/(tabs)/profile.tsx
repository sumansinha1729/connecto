import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { ListenerBadge } from '@/components/users/ListenerBadge';
import { Avatar, Button, Card, ListRow, Screen, Text } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { colors, spacing } from '@/theme';
import { confirm, notify } from '@/utils/dialog';
import { getErrorMessage } from '@/utils/errors';
import { formatAgeGender, formatCoins, maskPhone } from '@/utils/format';

export default function ProfileScreen() {
  const me = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const logout = useAuthStore((s) => s.logout);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const balance = useWalletStore((s) => s.balance);
  const [busy, setBusy] = useState(false);

  if (!me) return null;
  const isListener = me.role === 'listener' && me.listenerStatus === 'approved';

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      notify('Something went wrong', getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Delete account?',
      message: 'Your profile, coins and call history will be permanently deleted.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) run(deleteAccount);
  };

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.header}>
        <Avatar avatar={me.avatar} size={96} />
        <View style={styles.nameRow}>
          <Text variant="title">{me.name}</Text>
          {isListener && <ListenerBadge />}
        </View>
        <Text variant="caption" color="muted">
          {formatAgeGender(me.age, me.gender)} · {me.languages.join(', ')}
        </Text>
        <Text variant="caption" color="faint">
          {maskPhone(me.phone)}
        </Text>
        <Button title="Edit profile" icon="create-outline" variant="secondary" size="sm" onPress={() => router.push('/edit-profile')} />
      </View>

      {isListener ? (
        <>
          <Text variant="label" color="muted" style={styles.sectionTitle}>
            Listener
          </Text>
          <Card style={styles.group}>
            <ListRow
              icon="radio-button-on"
              label="Available for calls"
              right={
                <Switch
                  value={me.isAvailable}
                  onValueChange={(isAvailable) => run(() => updateProfile({ isAvailable }))}
                  disabled={busy}
                  trackColor={{ true: colors.success, false: colors.border }}
                  thumbColor={colors.white}
                />
              }
            />
            <ListRow icon="cash" label="Earnings" onPress={() => router.push('/earnings')} />
            <ListRow icon="card" label="Payout details" value={me.payoutMethodLabel ?? 'Not added'} onPress={() => router.push('/payout-method')} />
          </Card>
        </>
      ) : (
        <>
          <Text variant="label" color="muted" style={styles.sectionTitle}>
            Listener programme
          </Text>
          <Card style={styles.group}>
            {me.listenerStatus === 'pending' ? (
              <ListRow icon="hourglass-outline" label="Your application" value="Under review" onPress={() => router.push('/listener-apply')} />
            ) : (
              <ListRow
                icon="ribbon"
                label="Become a listener"
                value={me.listenerStatus === 'rejected' ? 'Not approved · apply again' : 'Earn by listening'}
                onPress={() => router.push('/listener-apply')}
              />
            )}
          </Card>
          {me.listenerStatus === 'rejected' && me.listenerApplication.note && (
            <Text variant="caption" color="muted" style={styles.note}>
              Reason: {me.listenerApplication.note}
            </Text>
          )}
        </>
      )}

      <Text variant="label" color="muted" style={styles.sectionTitle}>
        Account
      </Text>
      <Card style={styles.group}>
        {!isListener && (
          <ListRow icon="wallet" label="Wallet" value={`${formatCoins(balance)} coins`} onPress={() => router.push('/wallet')} />
        )}
        <ListRow icon="heart" label="Favourites" onPress={() => router.push('/favorites')} />
        <ListRow icon="ban" label="Blocked users" onPress={() => router.push('/blocked')} />
      </Card>

      <Card style={[styles.group, styles.lastGroup]}>
        <ListRow icon="log-out-outline" label="Log out" onPress={logout} />
        <ListRow icon="trash-outline" label="Delete account" danger onPress={onDelete} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm, marginLeft: spacing.xs },
  group: { padding: spacing.xs },
  lastGroup: { marginTop: spacing.xl },
  note: { marginTop: spacing.sm, marginLeft: spacing.xs },
});
