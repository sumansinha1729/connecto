import { Linking, StyleSheet, View } from 'react-native';

import { Avatar, Button, Icon, Screen, Text } from '@/components/ui';
import { ADMIN_PANEL_URL } from '@/constants/env';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';
import { notify } from '@/utils/dialog';

/**
 * Admin numbers don't use the user app (no calls, wallet or onboarding).
 * Admin work happens in the separate admin web panel.
 */
export default function AdminAccountScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const openPanel = () =>
    Linking.openURL(ADMIN_PANEL_URL).catch(() => notify('Couldn’t open the admin panel', `Open ${ADMIN_PANEL_URL} in your browser.`));

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button title="Open admin panel" icon="open-outline" onPress={openPanel} />
          <Button title="Log out" variant="ghost" size="sm" onPress={logout} />
        </View>
      }
    >
      <View style={styles.content}>
        <View style={styles.badge}>
          <Icon name="shield-checkmark" size={40} color={colors.primary} />
        </View>
        <Text variant="title" center>
          This is an admin account
        </Text>
        <Text variant="body" color="muted" center>
          Admin numbers manage Connecto from the admin panel: live calls, listener applications, payouts and reports. They can’t be used to
          talk to listeners in the app.
        </Text>
        {user && (
          <View style={styles.account}>
            <Avatar avatar={user.avatar} size={40} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{user.name || 'Admin'}</Text>
              <Text variant="caption" color="muted">
                {user.phone}
              </Text>
            </View>
          </View>
        )}
        <Text variant="caption" color="faint" center>
          {ADMIN_PANEL_URL}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.lg },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  flex: { flex: 1 },
  footer: { gap: spacing.sm, paddingHorizontal: spacing.lg },
});
