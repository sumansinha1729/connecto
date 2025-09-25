import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Header, Icon, Screen, Text } from '@/components/ui';
import { RECHARGE_PACKS } from '@/constants/options';
import { useWalletStore } from '@/store/walletStore';
import { colors, radius, spacing } from '@/theme';
import { notify } from '@/utils/dialog';
import { getErrorMessage } from '@/utils/errors';
import { formatCoins } from '@/utils/format';

export default function RechargeScreen() {
  const balance = useWalletStore((s) => s.balance);
  const recharge = useWalletStore((s) => s.recharge);
  const [selectedId, setSelectedId] = useState(RECHARGE_PACKS.find((p) => p.popular)?.id ?? RECHARGE_PACKS[0].id);
  const [paying, setPaying] = useState(false);
  const selected = RECHARGE_PACKS.find((p) => p.id === selectedId)!;

  const pay = async () => {
    setPaying(true);
    try {
      await recharge(selected.id);
      notify('Recharge successful', `${formatCoins(selected.coins + selected.bonus)} coins were added to your wallet.`);
      router.back();
    } catch (e) {
      notify('Payment failed', getErrorMessage(e));
      setPaying(false);
    }
  };

  return (
    <Screen
      scroll
      padded={false}
      footer={
        <View style={styles.footer}>
          <Button title={`Pay ₹${selected.priceInr}`} onPress={pay} loading={paying} />
          <Text variant="caption" color="faint" center>
            Demo mode: no real payment is taken.
          </Text>
        </View>
      }
    >
      <Header title="Recharge coins" back="close" />
      <View style={styles.content}>
        <View style={styles.balance}>
          <Text variant="caption" color="muted">
            Current balance
          </Text>
          <View style={styles.balanceRow}>
            <Icon name="logo-bitcoin" size={22} color={colors.coin} />
            <Text variant="title" color="coin">
              {formatCoins(balance)}
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          {RECHARGE_PACKS.map((pack) => {
            const active = pack.id === selectedId;
            return (
              <Pressable
                key={pack.id}
                onPress={() => setSelectedId(pack.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.pack, active && styles.packActive]}
              >
                {pack.popular && (
                  <View style={styles.popular}>
                    <Text variant="caption" style={styles.popularText}>
                      POPULAR
                    </Text>
                  </View>
                )}
                <View style={styles.balanceRow}>
                  <Icon name="logo-bitcoin" size={18} color={colors.coin} />
                  <Text variant="heading">{formatCoins(pack.coins)}</Text>
                </View>
                <Text variant="caption" color={pack.bonus ? 'success' : 'faint'}>
                  {pack.bonus ? `+${pack.bonus} bonus` : 'No bonus'}
                </Text>
                <Text variant="bodyStrong" style={styles.price}>
                  ₹{pack.priceInr}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  balance: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  pack: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  packActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  popular: {
    position: 'absolute',
    top: -10,
    right: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  popularText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  price: { marginTop: spacing.sm },
  footer: { gap: spacing.sm, paddingHorizontal: spacing.lg },
});
