import { router } from 'expo-router';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { StatCard } from '@/components/admin/StatCard';
import { Card, EmptyState, ListRow, LoadingView, Screen, Text } from '@/components/ui';
import { useAsyncData } from '@/hooks/useAsyncData';
import { adminApi } from '@/services/http/admin';
import { colors, spacing } from '@/theme';
import { formatRupees } from '@/utils/format';

/** Admin home: live numbers + shortcuts to the moderation queues. Only admins see this tab. */
export default function AdminDashboardScreen() {
  const { data: stats, loading, refreshing, error, refresh } = useAsyncData(() => adminApi.getStats(), [], {
    refetchOnFocus: true,
  });

  return (
    <Screen
      scroll
      edges={['top']}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <Text variant="title">Admin</Text>
        <Text variant="body" color="muted">
          Last 24 hours
        </Text>
      </View>

      {loading ? (
        <LoadingView />
      ) : !stats ? (
        <EmptyState icon="cloud-offline" title="Couldn’t load stats" message={error ?? undefined} actionLabel="Retry" onAction={refresh} />
      ) : (
        <>
          <Text variant="label" color="muted" style={styles.section}>
            Needs attention
          </Text>
          <View style={styles.grid}>
            <StatCard
              icon="ribbon"
              label="Applications"
              value={stats.listeners.pendingApplications}
              alert={stats.listeners.pendingApplications > 0}
              onPress={() => router.push('/admin/applications')}
            />
            <StatCard
              icon="flag"
              label="Open reports"
              value={stats.reports.open}
              alert={stats.reports.open > 0}
              onPress={() => router.push('/admin/reports')}
            />
            <StatCard
              icon="card"
              label="Payouts to send"
              value={stats.payouts.pending}
              sub={formatRupees(stats.payouts.pendingPaise)}
              alert={stats.payouts.pending > 0}
              onPress={() => router.push('/admin/payouts')}
            />
          </View>

          <Text variant="label" color="muted" style={styles.section}>
            Activity
          </Text>
          <View style={styles.grid}>
            <StatCard icon="people" label="Users" value={stats.users.total} sub={`+${stats.users.new24h} new · ${stats.users.onlineNow} online`} />
            <StatCard icon="headset" label="Listeners" value={stats.listeners.approved} sub={`${stats.listeners.availableNow} available now`} />
            <StatCard icon="call" label="Calls" value={stats.calls.completed24h} sub={`${stats.calls.activeNow} live now`} />
            <StatCard icon="time" label="Minutes talked" value={stats.calls.minutes24h} sub={`${stats.calls.coinsCharged24h} coins charged`} />
            <StatCard icon="cash" label="Revenue" value={`₹${stats.revenue.inr24h}`} sub={`${stats.revenue.recharges24h} recharges`} />
            <StatCard icon="wallet" label="Listener earnings" value={formatRupees(stats.listenerEarnings24hPaise)} sub="owed to listeners" />
            <StatCard icon="mic" label="Live rooms" value={stats.rooms.live} sub={`${stats.users.banned} banned users`} />
          </View>

          <Card style={styles.links}>
            <ListRow icon="search" label="Find a user" onPress={() => router.push('/admin/users')} />
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, paddingTop: spacing.md, paddingBottom: spacing.sm },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  links: { marginTop: spacing.xl, padding: spacing.xs },
});
