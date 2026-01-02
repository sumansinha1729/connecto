import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, Switch, View } from 'react-native';

import { CallRow } from '@/components/calls/CallRow';
import { Avatar, Card, EmptyState, Icon, ListRow, Screen, Text } from '@/components/ui';
import { useAsyncData } from '@/hooks/useAsyncData';
import { api } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { useEarningsStore } from '@/store/earningsStore';
import { colors, gradients, radius, spacing } from '@/theme';
import { notify } from '@/utils/dialog';
import { getErrorMessage } from '@/utils/errors';
import { formatRupees } from '@/utils/format';

/** Listener home: go available, see today's numbers and recent calls */
export default function ListenerDashboardScreen() {
  const me = useAuthStore((s) => s.user)!;
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const summary = useEarningsStore((s) => s.summary);
  const refreshEarnings = useEarningsStore((s) => s.refresh);
  const [toggling, setToggling] = useState(false);
  const { data: calls, refreshing, refresh } = useAsyncData(() => api.calls.getHistory(), [], { refetchOnFocus: true });

  useFocusEffect(
    useCallback(() => {
      refreshEarnings().catch(() => {});
    }, [refreshEarnings]),
  );

  const toggleAvailable = async (isAvailable: boolean) => {
    setToggling(true);
    try {
      await updateProfile({ isAvailable });
    } catch (e) {
      notify('Couldn’t update', getErrorMessage(e));
    } finally {
      setToggling(false);
    }
  };

  const onRefresh = async () => {
    await Promise.all([refresh(), refreshEarnings().catch(() => {})]);
  };

  return (
    <Screen
      scroll
      edges={['top']}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <Avatar avatar={me.avatar} size={44} online={me.isOnline && me.isAvailable} />
        <View style={styles.flex}>
          <Text variant="caption" color="muted">
            Listener
          </Text>
          <Text variant="heading">{me.name}</Text>
        </View>
        <View style={styles.rating}>
          <Icon name="star" size={14} color={colors.coin} />
          <Text variant="bodyStrong">{me.ratingCount ? me.rating.toFixed(1) : 'New'}</Text>
        </View>
      </View>

      <Card style={[styles.availability, me.isAvailable && styles.availabilityOn]}>
        <View style={styles.flex}>
          <Text variant="heading">{me.isAvailable ? 'You’re available' : 'You’re offline'}</Text>
          <Text variant="caption" color="muted">
            {me.isAvailable ? 'People can call you now. Keep the app open.' : 'Turn on to start receiving calls.'}
          </Text>
        </View>
        <Switch
          value={me.isAvailable}
          onValueChange={toggleAvailable}
          disabled={toggling}
          trackColor={{ true: colors.success, false: colors.border }}
          thumbColor={colors.white}
          accessibilityLabel="Available for calls"
        />
      </Card>

      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.today}>
        <Text variant="label" style={styles.todayLabel}>
          Today
        </Text>
        <Text variant="hero" color="white">
          {formatRupees(summary?.todayPaise ?? 0)}
        </Text>
        <View style={styles.todayStats}>
          <Text variant="caption" style={styles.todayLabel}>
            {summary?.callsToday ?? 0} calls · {summary?.minutesToday ?? 0} min
          </Text>
          <Text variant="caption" style={styles.todayLabel}>
            This week {formatRupees(summary?.weekPaise ?? 0)}
          </Text>
        </View>
      </LinearGradient>

      <Card style={styles.links}>
        <ListRow icon="wallet" label="Earnings" value={formatRupees(summary?.balancePaise ?? 0)} onPress={() => router.push('/earnings')} />
      </Card>

      <Text variant="heading" style={styles.section}>
        Recent calls
      </Text>
      {calls && calls.length > 0 ? (
        <View style={styles.bleed}>
          {calls.slice(0, 8).map((c) => (
            <CallRow key={c.id} call={c} onPress={() => router.push(`/user/${c.peer.id}`)} />
          ))}
        </View>
      ) : (
        <EmptyState icon="call" title="No calls yet" message="Go available and calls will show up here." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.lg },
  flex: { flex: 1 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  availability: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  availabilityOn: { borderColor: colors.success },
  today: { marginTop: spacing.lg, padding: spacing.xl, borderRadius: radius.xl, gap: spacing.xs },
  todayLabel: { color: 'rgba(255,255,255,0.85)' },
  todayStats: { flexDirection: 'row', justifyContent: 'space-between' },
  links: { marginTop: spacing.lg, padding: spacing.xs },
  section: { marginTop: spacing.xl, marginBottom: spacing.sm },
  bleed: { marginHorizontal: -spacing.lg },
});
