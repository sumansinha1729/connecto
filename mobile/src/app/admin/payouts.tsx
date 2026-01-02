import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, FormSheet, Header, LoadingView, Screen, Text } from '@/components/ui';
import { useAsyncData } from '@/hooks/useAsyncData';
import { adminApi } from '@/services/http/admin';
import { colors, spacing } from '@/theme';
import type { AdminPayout } from '@/types/admin';
import { formatRelativeTime, formatRupees } from '@/utils/format';

/** Listener withdrawal requests: pay them (outside the app), then record the reference here */
export default function PayoutsScreen() {
  const { data, setData, loading, refreshing, error, refresh } = useAsyncData(() => adminApi.listPayouts(), []);
  const [action, setAction] = useState<{ kind: 'paid' | 'reject'; payout: AdminPayout } | null>(null);

  const removeFromList = (id: string) => setData((data ?? []).filter((p) => p.id !== id));
  const total = (data ?? []).reduce((sum, p) => sum + p.amountPaise, 0);

  return (
    <Screen padded={false}>
      <Header title="Payouts" />
      <FlatList
        data={data ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          data && data.length > 0 ? (
            <Text variant="body" color="muted" style={styles.summary}>
              {data.length} request{data.length === 1 ? '' : 's'} · {formatRupees(total)} to pay
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            {item.listener && (
              <Pressable style={styles.row} onPress={() => router.push(`/admin/user/${item.listener!.id}`)}>
                <Avatar avatar={item.listener.avatar} size={44} />
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{item.listener.name}</Text>
                  <Text variant="caption" color="muted">
                    {item.listener.phone} · requested {formatRelativeTime(item.createdAt)}
                  </Text>
                </View>
                <Text variant="heading" color="success">
                  {formatRupees(item.amountPaise)}
                </Text>
              </Pressable>
            )}
            <View style={styles.method}>
              <Text variant="label" color="muted">
                Pay to
              </Text>
              {item.method.kind === 'upi' ? (
                <Text variant="bodyStrong" selectable>
                  UPI · {item.method.upiId}
                </Text>
              ) : (
                <Text variant="bodyStrong" selectable>
                  A/C {item.method.accountNumber} · IFSC {item.method.ifsc}
                </Text>
              )}
              <Text variant="caption" color="muted">
                {item.method.accountName}
              </Text>
            </View>
            <View style={styles.row}>
              <Button title="Reject" variant="secondary" size="sm" onPress={() => setAction({ kind: 'reject', payout: item })} style={styles.flex} />
              <Button title="Mark as paid" size="sm" icon="checkmark" onPress={() => setAction({ kind: 'paid', payout: item })} style={styles.flex} />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          loading ? (
            <LoadingView />
          ) : error ? (
            <EmptyState icon="cloud-offline" title="Couldn’t load" message={error} actionLabel="Retry" onAction={refresh} />
          ) : (
            <EmptyState icon="checkmark-done" title="No pending payouts" message="Listener withdrawal requests appear here." />
          )
        }
      />

      <FormSheet
        visible={action !== null}
        title={action?.kind === 'paid' ? `Paid ${formatRupees(action.payout.amountPaise)}?` : 'Reject withdrawal?'}
        message={
          action?.kind === 'paid'
            ? 'Send the money with your bank or UPI app first, then enter its reference number here.'
            : 'The money goes back to the listener’s balance.'
        }
        fields={
          action?.kind === 'paid'
            ? [{ key: 'value', label: 'UPI / bank reference (UTR)', placeholder: 'e.g. 412345678901', minLength: 4 }]
            : [{ key: 'value', label: 'Reason', placeholder: 'e.g. UPI ID is inactive', minLength: 3 }]
        }
        submitLabel={action?.kind === 'paid' ? 'Mark as paid' : 'Reject'}
        destructive={action?.kind === 'reject'}
        onClose={() => setAction(null)}
        onSubmit={async ({ value }) => {
          if (!action) return;
          if (action.kind === 'paid') await adminApi.markPayoutPaid(action.payout.id, value);
          else await adminApi.rejectPayout(action.payout.id, value);
          removeFromList(action.payout.id);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  summary: { marginBottom: spacing.md },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  method: { gap: 2 },
  flex: { flex: 1 },
});
