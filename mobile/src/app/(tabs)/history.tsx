import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, View } from 'react-native';

import { CallRow } from '@/components/calls/CallRow';
import { RateCallSheet } from '@/components/calls/RateCallSheet';
import { Avatar, EmptyState, LoadingView, Screen, Text } from '@/components/ui';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useStartCall } from '@/hooks/useStartCall';
import { api } from '@/services';
import { selectIsListener, useAuthStore } from '@/store/authStore';
import { colors, gradients, radius, spacing } from '@/theme';
import type { CallRecord, User } from '@/types';
import { notify } from '@/utils/dialog';
import { getErrorMessage } from '@/utils/errors';
import { formatCoins, formatDayLabel, formatRupees, formatTalkTime } from '@/utils/format';

type Filter = 'all' | 'talked' | 'missed';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.chip, active && styles.chipActive]}>
      <Text variant="caption" style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryItem({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text variant="heading" style={styles.summaryValue}>
        {value}
      </Text>
      <Text variant="caption" style={styles.summaryLabel}>
        {label}
      </Text>
    </View>
  );
}

export default function CallsScreen() {
  const startCall = useStartCall();
  const isListener = useAuthStore(selectIsListener);
  const [filter, setFilter] = useState<Filter>('all');
  const [older, setOlder] = useState<CallRecord[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMore, setNoMore] = useState(false);
  const [rating, setRating] = useState<CallRecord | null>(null);
  const [rated, setRated] = useState<Record<string, number>>({});

  const { data, loading, refreshing, error, refresh } = useAsyncData(
    async () => {
      const page = await api.calls.getHistory();
      setOlder([]);
      setNoMore(page.length < 30);
      return page;
    },
    [],
    { refetchOnFocus: true },
  );

  const calls = useMemo(
    () => [...(data ?? []), ...older].map((c) => (rated[c.id] ? { ...c, rating: rated[c.id] } : c)),
    [data, older, rated],
  );

  const loadMore = useCallback(async () => {
    const last = calls.at(-1);
    if (!last || loadingMore || noMore || loading) return;
    setLoadingMore(true);
    try {
      const page = await api.calls.getHistory(last.startedAt);
      setOlder((prev) => [...prev, ...page]);
      if (page.length < 30) setNoMore(true);
    } catch {
      // Try again on the next scroll
    } finally {
      setLoadingMore(false);
    }
  }, [calls, loadingMore, noMore, loading]);

  // Last 7 days, from what's loaded (the newest page covers it for almost everyone)
  const week = useMemo(() => {
    const recent = calls.filter((c) => Date.now() - Date.parse(c.startedAt) < WEEK_MS && c.status === 'completed');
    return {
      calls: recent.length,
      seconds: recent.reduce((n, c) => n + c.durationSec, 0),
      coins: recent.reduce((n, c) => n + c.coins, 0),
      earnedPaise: recent.reduce((n, c) => n + c.earnedPaise, 0),
    };
  }, [calls]);

  // Listeners you've talked to, most recent first (users only: listeners can't call out)
  const talkAgain = useMemo(() => {
    if (isListener) return [];
    const seen = new Map<string, User>();
    for (const c of calls) if (c.status === 'completed' && !seen.has(c.peer.id)) seen.set(c.peer.id, c.peer);
    const freeNow = (u: User) => Number(u.isOnline && u.isAvailable && !u.isBusy);
    return [...seen.values()].sort((a, b) => freeNow(b) - freeNow(a)).slice(0, 10);
  }, [calls, isListener]);

  const missedCount = calls.filter((c) => c.status !== 'completed').length;
  const sections = useMemo(() => {
    const shown = calls.filter((c) => (filter === 'all' ? true : filter === 'talked' ? c.status === 'completed' : c.status !== 'completed'));
    const groups = new Map<string, CallRecord[]>();
    for (const c of shown) {
      const day = formatDayLabel(c.startedAt);
      groups.set(day, [...(groups.get(day) ?? []), c]);
    }
    return [...groups.entries()].map(([title, items]) => ({ title, data: items }));
  }, [calls, filter]);

  const callBack = (peer: User) => {
    if (peer.isBusy) {
      notify(`${peer.name} is on another call`, 'Try again in a few minutes.');
      return;
    }
    if (!peer.isOnline || !peer.isAvailable) {
      notify(`${peer.name} isn’t available right now`, 'Listeners with a green dot are online and free to talk.');
      return;
    }
    startCall(peer);
  };

  const submitRating = async (call: CallRecord, stars: number) => {
    try {
      await api.calls.rateCall(call.id, stars);
      setRated((r) => ({ ...r, [call.id]: stars }));
    } catch (e) {
      notify('Couldn’t save your rating', getErrorMessage(e));
      throw e;
    }
  };

  const header = (
    <View style={styles.header}>
      <Text variant="title">Calls</Text>

      {calls.length > 0 && (
        <LinearGradient colors={gradients.call} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summary}>
          <Text variant="caption" style={styles.summaryTitle}>
            Last 7 days
          </Text>
          <View style={styles.summaryRow}>
            <SummaryItem value={formatTalkTime(week.seconds)} label="Talk time" />
            <View style={styles.divider} />
            <SummaryItem value={String(week.calls)} label={week.calls === 1 ? 'Call' : 'Calls'} />
            <View style={styles.divider} />
            {isListener ? (
              <SummaryItem value={formatRupees(week.earnedPaise)} label="Earned" />
            ) : (
              <SummaryItem value={formatCoins(week.coins)} label="Coins spent" />
            )}
          </View>
        </LinearGradient>
      )}

      {talkAgain.length > 0 && (
        <View style={styles.talkAgain}>
          <Text variant="label" color="muted">
            Talk again
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people} style={styles.peopleScroll}>
            {talkAgain.map((p) => {
              const free = p.isOnline && p.isAvailable && !p.isBusy;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => callBack(p)}
                  onLongPress={() => router.push(`/user/${p.id}`)}
                  style={styles.person}
                  accessibilityRole="button"
                  accessibilityLabel={free ? `Call ${p.name}` : `${p.name}, not available`}
                >
                  <Avatar avatar={p.avatar} size={56} online={p.isOnline} />
                  <Text variant="caption" numberOfLines={1} style={styles.personName}>
                    {p.name}
                  </Text>
                  <Text variant="caption" style={{ color: free ? colors.success : p.isBusy ? colors.warning : colors.textFaint, fontSize: 11 }}>
                    {free ? 'Free now' : p.isBusy ? 'On a call' : p.isOnline ? 'Away' : 'Offline'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {calls.length > 0 && (
        <View style={styles.chips}>
          <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterChip label="Talked" active={filter === 'talked'} onPress={() => setFilter('talked')} />
          <FilterChip label={missedCount ? `Missed · ${missedCount}` : 'Missed'} active={filter === 'missed'} onPress={() => setFilter('missed')} />
        </View>
      )}
    </View>
  );

  return (
    <Screen padded={false} edges={['top']}>
      <SectionList
        sections={sections}
        keyExtractor={(c) => c.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text variant="label" color="muted" style={styles.sectionTitle}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <CallRow
            call={item}
            onPress={() => router.push(`/user/${item.peer.id}`)}
            onCallBack={isListener ? undefined : () => callBack(item.peer)}
            onRate={isListener ? undefined : () => setRating(item)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <LoadingView />
          ) : error ? (
            <EmptyState icon="cloud-offline" title="Couldn’t load calls" message={error} actionLabel="Retry" onAction={refresh} />
          ) : filter !== 'all' ? (
            <EmptyState icon="call" title={filter === 'missed' ? 'No missed calls' : 'No calls yet'} actionLabel="Show all calls" onAction={() => setFilter('all')} />
          ) : isListener ? (
            <EmptyState icon="call" title="No calls yet" message="Turn on Available on your Home tab and users can call you." />
          ) : (
            <EmptyState
              icon="call"
              title="No calls yet"
              message="Talk to a listener and your calls will show up here."
              actionLabel="Find someone to talk to"
              onAction={() => router.push('/')}
            />
          )
        }
        ListFooterComponent={loadingMore ? <LoadingView /> : null}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
      <RateCallSheet call={rating} onSubmit={submitRating} onClose={() => setRating(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 120 },
  header: { gap: spacing.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  summary: { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.glassSubtle },
  summaryTitle: { color: colors.textOnGradient, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { color: colors.white },
  summaryLabel: { color: colors.textOnGradient },
  divider: { width: 1, height: 32, backgroundColor: colors.glassStrong },
  talkAgain: { gap: spacing.sm },
  peopleScroll: { marginHorizontal: -spacing.lg },
  people: { gap: spacing.lg, paddingHorizontal: spacing.lg },
  person: { width: 64, alignItems: 'center', gap: 2 },
  personName: { color: colors.text, fontWeight: '600', marginTop: 4, maxWidth: 64 },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: colors.text },
  sectionTitle: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs },
});
