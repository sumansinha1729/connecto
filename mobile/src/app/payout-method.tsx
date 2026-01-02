import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, Header, Screen, Text, TextField } from '@/components/ui';
import { api } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { spacing } from '@/theme';
import type { PayoutMethodInput } from '@/types';
import { getErrorMessage } from '@/utils/errors';
import { goBack } from '@/utils/navigation';

/** Where a listener's withdrawals are paid: UPI ID or bank account */
export default function PayoutMethodScreen() {
  const [kind, setKind] = useState<'upi' | 'bank'>('upi');
  const [accountName, setAccountName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    const method: PayoutMethodInput =
      kind === 'upi'
        ? { kind, upiId: upiId.trim(), accountName: accountName.trim() }
        : { kind, accountName: accountName.trim(), accountNumber: accountNumber.trim(), ifsc: ifsc.trim().toUpperCase() };
    try {
      const user = await api.earnings.setPayoutMethod(method);
      useAuthStore.setState({ user });
      goBack();
    } catch (e) {
      setError(getErrorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Screen
      scroll
      keyboard
      padded={false}
      footer={
        <View style={styles.footer}>
          <Button title="Save payout details" onPress={save} loading={saving} />
        </View>
      }
    >
      <Header title="Payout details" back="close" />
      <View style={styles.content}>
        <Text variant="body" color="muted">
          Your earnings are sent here. Only our payments team sees these details.
        </Text>
        <View style={styles.kinds}>
          <Chip label="UPI" icon="flash" selected={kind === 'upi'} onPress={() => setKind('upi')} />
          <Chip label="Bank account" icon="business" selected={kind === 'bank'} onPress={() => setKind('bank')} />
        </View>
        <TextField label="Account holder name" placeholder="As on your bank account" value={accountName} onChangeText={setAccountName} autoCapitalize="words" />
        {kind === 'upi' ? (
          <TextField label="UPI ID" placeholder="name@okicici" value={upiId} onChangeText={setUpiId} autoCapitalize="none" autoCorrect={false} />
        ) : (
          <>
            <TextField
              label="Account number"
              placeholder="9–18 digits"
              value={accountNumber}
              onChangeText={(t) => setAccountNumber(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={18}
            />
            <TextField label="IFSC code" placeholder="SBIN0001234" value={ifsc} onChangeText={setIfsc} autoCapitalize="characters" maxLength={11} />
          </>
        )}
        {error && (
          <Text variant="caption" color="danger">
            {error}
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  kinds: { flexDirection: 'row', gap: spacing.sm },
  footer: { paddingHorizontal: spacing.lg },
});
