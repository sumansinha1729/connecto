import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { StatusBadge } from '@/components/admin/StatusBadge';
import { CallRow } from '@/components/calls/CallRow';
import { VoicePlayer } from '@/components/listener/VoicePlayer';
import { Avatar, Button, Card, EmptyState, FormSheet, Header, LoadingView, Screen, Text, type FormField } from '@/components/ui';
import { TransactionRow } from '@/components/wallet/TransactionRow';
import { REPORT_REASONS } from '@/constants/options';
import { useAsyncData } from '@/hooks/useAsyncData';
import { adminApi } from '@/services/http/admin';
import { colors, spacing } from '@/theme';
import { confirm, notify } from '@/utils/dialog';
import { ApiError, getErrorMessage } from '@/utils/errors';
import { formatAgeGender, formatCoins, formatDateOfBirth, formatRelativeTime, formatRupees } from '@/utils/format';

type SheetKind = 'ban' | 'coins' | 'revoke';

const SHEETS: Record<SheetKind, { title: string; message: string; submit: string; destructive?: boolean; fields: FormField[] }> = {
  ban: {
    title: 'Ban this user?',
    message: 'They’ll be logged out everywhere, their calls end, and they can’t use the app until unbanned.',
    submit: 'Ban',
    destructive: true,
    fields: [{ key: 'reason', label: 'Reason', placeholder: 'e.g. Repeated harassment', minLength: 3 }],
  },
  coins: {
    title: 'Adjust coins',
    message: 'Use a negative number to remove coins.',
    submit: 'Apply',
    fields: [
      { key: 'amount', label: 'Amount', placeholder: 'e.g. 50 or -20', keyboardType: 'numbers-and-punctuation' },
      { key: 'reason', label: 'Reason', placeholder: 'e.g. Refund for dropped call', minLength: 3 },
    ],
  },
  revoke: {
    title: 'Remove listener rights?',
    message: 'They become a regular user and stop receiving calls.',
    submit: 'Remove',
    destructive: true,
    fields: [{ key: 'note', label: 'Reason', placeholder: 'e.g. Too many complaints', minLength: 3 }],
  },
};

const reasonLabel = (reason: string) => REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;

export default function AdminUserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, refreshing, error, refresh } = useAsyncData(() => adminApi.getUser(id), [id]);
  const [sheet, setSheet] = useState<SheetKind | null>(null);

  const unban = async () => {
    if (!(await confirm({ title: 'Unban this user?', confirmText: 'Unban' }))) return;
    try {
      await adminApi.unban(id);
      refresh();
    } catch (e) {
      notify('Couldn’t unban', getErrorMessage(e));
    }
  };

  const submitSheet = async (values: Record<string, string>) => {
    if (sheet === 'ban') await adminApi.ban(id, values.reason);
    if (sheet === 'revoke') await adminApi.revokeListener(id, values.note);
    if (sheet === 'coins') {
      const amount = Number(values.amount);
      if (!Number.isInteger(amount) || amount === 0) throw new ApiError('VALIDATION', 'Enter a whole number, not 0.');
      await adminApi.adjustWallet(id, amount, values.reason);
    }
    refresh();
  };

  if (loading) {
    return (
      <Screen padded={false}>
        <Header />
        <LoadingView />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen padded={false}>
        <Header />
        <EmptyState icon="person" title="Couldn’t load user" message={error ?? undefined} actionLabel="Retry" onAction={refresh} />
      </Screen>
    );
  }

  const { user, wallet, calls, reports } = data;
  const config = sheet ? SHEETS[sheet] : null;

  return (
    <Screen
      scroll
      padded={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <Header title={user.name || 'User'} />
      <View style={styles.content}>
        <View style={styles.hero}>
          <Avatar avatar={user.avatar} size={80} online={user.isOnline} />
          <View style={styles.badges}>
            <StatusBadge label={user.status} tone={user.status} />
            {user.role === 'listener' && <StatusBadge label="listener" tone="listener" />}
            {user.listenerStatus === 'pending' && <StatusBadge label="applied" tone="pending" />}
          </View>
          <Text variant="body" color="muted">
            {user.phone} · {formatAgeGender(user.age, user.gender)}
          </Text>
          <Text variant="caption" color="faint">
            Joined {formatRelativeTime(user.createdAt)}
            {user.lastSeenAt ? ` · last seen ${formatRelativeTime(user.lastSeenAt)}` : ''}
          </Text>
          {user.banReason && (
            <Text variant="caption" color="danger">
              Banned: {user.banReason}
            </Text>
          )}
        </View>

        <View style={styles.stats}>
          <Card style={styles.stat}>
            <Text variant="heading">{formatCoins(wallet.balance)}</Text>
            <Text variant="caption" color="muted">
              coins
            </Text>
          </Card>
          <Card style={styles.stat}>
            <Text variant="heading">{user.totalCalls}</Text>
            <Text variant="caption" color="muted">
              calls
            </Text>
          </Card>
          <Card style={styles.stat}>
            <Text variant="heading">{user.ratingCount ? `★ ${user.rating.toFixed(1)}` : '—'}</Text>
            <Text variant="caption" color="muted">
              rating
            </Text>
          </Card>
        </View>

        <View style={styles.actions}>
          {user.status === 'banned' ? (
            <Button title="Unban" variant="secondary" size="sm" icon="refresh" onPress={unban} style={styles.flex} />
          ) : user.status === 'active' && !user.isAdmin ? (
            <Button title="Ban" variant="danger" size="sm" icon="ban" onPress={() => setSheet('ban')} style={styles.flex} />
          ) : null}
          <Button title="Adjust coins" variant="secondary" size="sm" icon="logo-bitcoin" onPress={() => setSheet('coins')} style={styles.flex} />
        </View>
        {user.listenerStatus === 'approved' && (
          <Button title="Remove listener rights" variant="secondary" size="sm" onPress={() => setSheet('revoke')} />
        )}

        {user.listenerStatus !== 'none' && (
          <Section title={`Listener application · ${user.listenerStatus}`}>
            <Text variant="caption" color="muted">
              {[user.listenerApplication.fullName, formatDateOfBirth(user.listenerApplication.dateOfBirth), user.listenerApplication.city].filter(Boolean).join(' · ')}
            </Text>
            {user.listenerApplication.about && <Text variant="body">“{user.listenerApplication.about}”</Text>}
            {user.listenerApplication.voiceIntroUrl && (
              <VoicePlayer
                key={user.listenerApplication.voiceIntroUrl}
                uri={user.listenerApplication.voiceIntroUrl}
                fallbackDurationSec={user.listenerApplication.voiceIntroDurationSec}
              />
            )}
            {user.listenerApplication.note && (
              <Text variant="caption" color="faint">
                Note: {user.listenerApplication.note}
              </Text>
            )}
          </Section>
        )}

        {user.role === 'listener' && (
          <Section title="Earnings">
            <Text variant="body">
              {formatRupees(data.earnings.balancePaise)} available · {formatRupees(data.earnings.lifetimePaise)} lifetime
            </Text>
            <Text variant="caption" color="muted">
              Payout details: {user.payoutMethodLabel ?? 'not added'}
            </Text>
            {data.earnings.payouts.map((p) => (
              <Text key={p.id} variant="caption" color="muted">
                • {formatRupees(p.amountPaise)} · {p.status} · {formatRelativeTime(p.createdAt)}
                {p.reference ? ` · ref ${p.reference}` : ''}
              </Text>
            ))}
          </Section>
        )}

        <Section title={`Reports against (${reports.against.length})`}>
          {reports.against.length === 0 ? (
            <Text variant="caption" color="faint">
              None
            </Text>
          ) : (
            reports.against.map((r) => (
              <Text key={r.id} variant="caption" color="muted">
                • {reasonLabel(r.reason)}
                {r.details ? `: “${r.details}”` : ''} · {r.status} · {formatRelativeTime(r.createdAt)}
              </Text>
            ))
          )}
        </Section>

        <Section title="Recent calls">
          {calls.length === 0 ? (
            <Text variant="caption" color="faint">
              None
            </Text>
          ) : (
            <View style={styles.bleed}>
              {calls.slice(0, 5).map((c) => (
                <CallRow key={c.id} call={c} onPress={() => {}} />
              ))}
            </View>
          )}
        </Section>

        <Section title="Recent transactions">
          {wallet.transactions.slice(0, 8).map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </Section>
      </View>

      <FormSheet
        visible={config !== null}
        title={config?.title ?? ''}
        message={config?.message}
        fields={config?.fields ?? []}
        submitLabel={config?.submit ?? ''}
        destructive={config?.destructive}
        onClose={() => setSheet(null)}
        onSubmit={submitSheet}
      />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label" color="muted">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, alignItems: 'center', gap: 2, padding: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  section: { gap: spacing.sm },
  bleed: { marginHorizontal: -spacing.lg },
});
