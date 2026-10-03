import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Button, EmptyState, Icon, LoadingView, Screen, Text } from '@/components/ui';
import { TransactionRow } from '@/components/wallet/TransactionRow';
import { CALL_RATE_PER_MIN } from '@/constants/config';
import { useWalletStore } from '@/store/walletStore';
import { colors, gradients, radius, spacing } from '@/theme';
import { formatCoins } from '@/utils/format';

export default function WalletScreen() {
  const { balance, transactions, loaded, refresh } = useWalletStore();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh().catch(() => {});
    setRefreshing(false);
  };

  return (
    <Screen padded={false} edges={['top']}>
      <FlatList
        data={transactions}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <TransactionRow tx={item} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="title">Wallet</Text>

            <LinearGradient colors={gradients.coin} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceCard}>
              <Text variant="label" style={styles.balanceLabel}>
                Coin balance
              </Text>
              <View style={styles.balanceRow}>
                <Icon name="logo-bitcoin" size={32} color={colors.white} />
                <Text variant="hero" color="white">
                  {formatCoins(balance)}
                </Text>
              </View>
              <Text variant="caption" style={styles.balanceSub}>
                ≈ {Math.floor(balance / CALL_RATE_PER_MIN)} minutes of calling
              </Text>
              <Button title="Recharge" icon="add" variant="secondary" onPress={() => router.push('/recharge')} style={styles.rechargeButton} />
            </LinearGradient>

            <View style={styles.infoRow}>
              <Icon name="information-circle" size={18} color={colors.textMuted} />
              <Text variant="caption" color="muted" style={styles.infoText}>
                Calls cost {CALL_RATE_PER_MIN} coins per minute, charged at the start of each minute.
              </Text>
            </View>

            <Text variant="heading">History</Text>
          </View>
        }
        ListEmptyComponent={
          loaded ? <EmptyState icon="receipt" title="No transactions yet" /> : <LoadingView />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  balanceCard: { borderRadius: radius.xl, padding: spacing.xl, gap: spacing.xs },
  balanceLabel: { color: colors.textOnGradient },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  balanceSub: { color: colors.textOnGradient },
  rechargeButton: { marginTop: spacing.md },
  infoRow: { flexDirection: 'row', gap: spacing.sm },
  infoText: { flex: 1 },
  separator: { height: 1, backgroundColor: colors.border },
});
