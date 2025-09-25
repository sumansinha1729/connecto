import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar, CoinBadge, EmptyState, Icon, LoadingView, Screen, Text } from '@/components/ui';
import { FilterBar } from '@/components/users/FilterBar';
import { UserCard } from '@/components/users/UserCard';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useStartCall } from '@/hooks/useStartCall';
import { api } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { colors, gradients, radius, spacing } from '@/theme';
import type { UserFilters } from '@/types';

export default function HomeScreen() {
  const me = useAuthStore((s) => s.user);
  const balance = useWalletStore((s) => s.balance);
  const startCall = useStartCall();

  const [filters, setFilters] = useState<UserFilters>({});
  const { data: users, loading, refreshing, error, refresh } = useAsyncData(
    () => api.users.listUsers(filters),
    [filters],
    { refetchOnFocus: true },
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.push('/profile')} style={styles.greeting}>
          {me && <Avatar avatar={me.avatar} size={40} />}
          <View>
            <Text variant="caption" color="muted">
              Welcome back
            </Text>
            <Text variant="heading">{me?.name}</Text>
          </View>
        </Pressable>
        <CoinBadge amount={balance} onPress={() => router.push('/recharge')} />
      </View>

      <Pressable onPress={() => router.push('/match')} accessibilityRole="button">
        {({ pressed }) => (
          <LinearGradient
            colors={gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.banner, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.bannerText}>
              <Text variant="heading" color="white">
                Need someone to talk to?
              </Text>
              <Text variant="caption" style={styles.bannerSub}>
                We’ll connect you with a free listener in seconds.
              </Text>
              <View style={styles.bannerCta}>
                <Text variant="caption" style={styles.bannerCtaText}>
                  Talk now
                </Text>
                <Icon name="arrow-forward" size={14} color={colors.primaryDark} />
              </View>
            </View>
            <Icon name="headset" size={64} color="rgba(255,255,255,0.35)" />
          </LinearGradient>
        )}
      </Pressable>

      <Text variant="heading">People to talk to</Text>
      <View style={styles.filters}>
        <FilterBar value={filters} onChange={setFilters} preferredLanguages={me?.languages} />
      </View>
    </View>
  );

  return (
    <Screen padded={false} edges={['top']}>
      <FlatList
        data={users ?? []}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <UserCard user={item} onPress={() => router.push(`/user/${item.id}`)} onCall={() => startCall(item)} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <LoadingView />
          ) : error ? (
            <EmptyState icon="cloud-offline" title="Couldn’t load people" message={error} actionLabel="Retry" onAction={refresh} />
          ) : (
            <EmptyState
              icon="people"
              title="No one matches"
              message="Try removing some filters."
              actionLabel="Clear filters"
              onAction={() => setFilters({})}
            />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: radius.xl,
  },
  bannerText: { flex: 1, gap: spacing.xs },
  bannerSub: { color: 'rgba(255,255,255,0.85)' },
  bannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
  bannerCtaText: { color: colors.primaryDark, fontWeight: '700' },
  filters: { marginHorizontal: -spacing.lg },
});
