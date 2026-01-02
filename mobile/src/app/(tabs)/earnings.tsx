import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, Icon, ListRow, LoadingView, Screen, Text, type IconName } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useEarningsStore } from '@/store/earningsStore';
import { colors, radius, spacing } from '@/theme';
import type { EarningsEntry, Payout } from '@/types';
import { confirm, notify } from '@/utils/dialog';
import { getErrorMessage } from '@/utils/errors';
import { formatRelativeTime, formatRupees } from '@/utils/format';

const ENTRY_ICON: Record<EarningsEntry['type'], IconName> = {
  call: 'call',
  payout: 'arrow-up-circle',
  payout_reversal: 'arrow-undo',
  adjustment: 'construct',
};

const PAYOUT_STATUS: Record<Payout['status'], { label: string; color: string }> = {
  requested: { label: 'Processing', color: colors.warning },
  paid: { label: 'Paid', color: colors.success },
  rejected: { label: 'Returned', color: colors.danger },
};

/** Listener earnings: balance, withdrawals and history */
export default function EarningsScreen() {
  const payoutLabel = useAuthStore((s) => s.user?.payoutMethodLabel ?? null);
  const summary = useEarningsStore((s) => s.summary);
  const refresh = useEarningsStore((s) => s.refresh);
  const withdraw = useEarningsStore((s) => s.withdraw);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  if (!summary) {
    return (
      <Screen edges={['top']}>
        <LoadingView />
      </Screen>
    );
  }

  const { balancePaise, settings } = summary;
  const openPayout = summary.payouts.find((p) => p.status === 'requested');
  const canWithdraw = balancePaise >= settings.minWithdrawalPaise && !openPayout;

  const onWithdraw = async () => {
    if (!payoutLabel) {
      router.push('/payout-method');
      return;
    }
    const ok = await confirm({
      title: `Withdraw ${formatRupees(balancePaise)}?`,
      message: `It will be sent to ${payoutLabel}. Payouts are processed ${settings.schedule}.`,
      confirmText: 'Withdraw',
    });
    if (!ok) return;
    setWithdrawing(true);
    try {
      await withdraw();
      notify('Withdrawal requested', `We’ll send ${formatRupees(balancePaise)} to ${payoutLabel} in the next ${settings.schedule} payout.`);
    } catch (e) {
      notify('Couldn’t withdraw', getErrorMessage(e));
    } finally {
      setWithdrawing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh().catch(() => {});
    setRefreshing(false);
  };

  return (
    <Screen
      scroll
      edges={['top']}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <Text variant="title">Earnings</Text>
      </View>

      <Card style={styles.balance}>
        <Text variant="label" color="muted">
          Available to withdraw
        </Text>
        <Text variant="hero" color="success">
          {formatRupees(balancePaise)}
        </Text>
        <Text variant="caption" color="muted">
          {formatRupees(settings.ratePaisePerMin)} per minute · lifetime {formatRupees(summary.lifetimePaise)}
        </Text>
        <Button
          title={openPayout ? 'Withdrawal in progress' : 'Withdraw'}
          icon="arrow-up-circle"
          onPress={onWithdraw}
          disabled={!canWithdraw}
          loading={withdrawing}
          style={styles.withdraw}
        />
        <Text variant="caption" color="faint" center>
          {openPayout
            ? `${formatRupees(openPayout.amountPaise)} is on its way to ${openPayout.methodLabel}.`
            : balancePaise < settings.minWithdrawalPaise
              ? `You can withdraw from ${formatRupees(settings.minWithdrawalPaise)}. Payouts are sent ${settings.schedule}.`
              : `Payouts are sent ${settings.schedule}.`}
        </Text>
      </Card>

      <Card style={styles.group}>
        <ListRow
          icon="card"
          label="Payout details"
          value={payoutLabel ?? 'Add UPI or bank'}
          onPress={() => router.push('/payout-method')}
        />
      </Card>

      {summary.payouts.length > 0 && (
        <>
          <Text variant="heading" style={styles.section}>
            Withdrawals
          </Text>
          <Card style={styles.list}>
            {summary.payouts.map((p) => (
              <View key={p.id} style={styles.row}>
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{formatRupees(p.amountPaise)}</Text>
                  <Text variant="caption" color="muted">
                    {p.methodLabel} · {formatRelativeTime(p.createdAt)}
                    {p.reference ? ` · ref ${p.reference}` : ''}
                    {p.note ? ` · ${p.note}` : ''}
                  </Text>
                </View>
                <Text variant="caption" style={{ color: PAYOUT_STATUS[p.status].color, fontWeight: '700' }}>
                  {PAYOUT_STATUS[p.status].label}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}

      <Text variant="heading" style={styles.section}>
        History
      </Text>
      {summary.entries.length === 0 ? (
        <EmptyState icon="cash" title="No earnings yet" message="Go available from your dashboard to start taking calls." />
      ) : (
        <Card style={styles.list}>
          {summary.entries.map((e) => (
            <View key={e.id} style={styles.row}>
              <View style={[styles.entryIcon, { backgroundColor: e.amountPaise >= 0 ? colors.successSoft : colors.primarySoft }]}>
                <Icon name={ENTRY_ICON[e.type]} size={16} color={e.amountPaise >= 0 ? colors.success : colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {e.description}
                </Text>
                <Text variant="caption" color="faint">
                  {formatRelativeTime(e.createdAt)}
                </Text>
              </View>
              <Text variant="bodyStrong" style={{ color: e.amountPaise >= 0 ? colors.success : colors.text }}>
                {formatRupees(e.amountPaise, true)}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  balance: { gap: spacing.sm, alignItems: 'center', padding: spacing.xl, borderRadius: radius.xl },
  withdraw: { alignSelf: 'stretch', marginTop: spacing.md },
  group: { marginTop: spacing.lg, padding: spacing.xs },
  section: { marginTop: spacing.xl, marginBottom: spacing.sm },
  list: { padding: spacing.md, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  entryIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
