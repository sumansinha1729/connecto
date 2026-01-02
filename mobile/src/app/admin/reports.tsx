import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, FormSheet, Header, Icon, LoadingView, Screen, Text } from '@/components/ui';
import { REPORT_REASONS } from '@/constants/options';
import { useAsyncData } from '@/hooks/useAsyncData';
import { adminApi } from '@/services/http/admin';
import { colors, spacing } from '@/theme';
import type { AdminReport } from '@/types/admin';
import { notify } from '@/utils/dialog';
import { getErrorMessage } from '@/utils/errors';
import { formatRelativeTime } from '@/utils/format';

const reasonLabel = (reason: string) => REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;

export default function ReportsScreen() {
  const { data, setData, loading, refreshing, error, refresh } = useAsyncData(() => adminApi.listReports(), []);
  const [banning, setBanning] = useState<AdminReport | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const removeFromList = (id: string) => setData((data ?? []).filter((r) => r.id !== id));

  const dismiss = async (report: AdminReport) => {
    setBusyId(report.id);
    try {
      await adminApi.resolveReport(report.id, { status: 'reviewed', note: 'No action needed' });
      removeFromList(report.id);
    } catch (e) {
      notify('Couldn’t update report', getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen padded={false}>
      <Header title="Open reports" />
      <FlatList
        data={data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            {item.reported && (
              <Pressable style={styles.row} onPress={() => router.push(`/admin/user/${item.reported!.id}`)}>
                <Avatar avatar={item.reported.avatar} size={44} />
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{item.reported.name}</Text>
                  <Text variant="caption" color="muted">
                    {item.reportedOpenReports} open report{item.reportedOpenReports === 1 ? '' : 's'}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.textFaint} />
              </Pressable>
            )}
            <View style={styles.reason}>
              <Icon name="flag" size={14} color={colors.danger} />
              <Text variant="bodyStrong">{reasonLabel(item.reason)}</Text>
            </View>
            {Boolean(item.details) && <Text variant="body">“{item.details}”</Text>}
            <Text variant="caption" color="faint">
              Reported by {item.reporter?.name ?? 'unknown'} · {formatRelativeTime(item.createdAt)}
            </Text>
            <View style={styles.row}>
              <Button title="Dismiss" variant="secondary" size="sm" loading={busyId === item.id} onPress={() => dismiss(item)} style={styles.flex} />
              <Button title="Ban user" variant="danger" size="sm" icon="ban" onPress={() => setBanning(item)} style={styles.flex} />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          loading ? (
            <LoadingView />
          ) : error ? (
            <EmptyState icon="cloud-offline" title="Couldn’t load" message={error} actionLabel="Retry" onAction={refresh} />
          ) : (
            <EmptyState icon="shield-checkmark" title="No open reports" message="Nothing needs reviewing right now." />
          )
        }
      />

      <FormSheet
        visible={banning !== null}
        title={`Ban ${banning?.reported?.name ?? 'user'}?`}
        message="They’ll be logged out everywhere and can’t use the app until unbanned."
        fields={[{ key: 'note', label: 'Reason', placeholder: 'e.g. Harassment confirmed', minLength: 3 }]}
        submitLabel="Ban"
        destructive
        onClose={() => setBanning(null)}
        onSubmit={async ({ note }) => {
          if (!banning) return;
          await adminApi.resolveReport(banning.id, { status: 'actioned', note, ban: true });
          // Other open reports about the same person are still worth reading, so only drop this one
          removeFromList(banning.id);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reason: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
});
