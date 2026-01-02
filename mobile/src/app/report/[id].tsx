import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Button, Header, Icon, Screen, Text, TextField } from '@/components/ui';
import { REPORT_REASONS } from '@/constants/options';
import { api } from '@/services';
import { colors, radius, spacing } from '@/theme';
import type { ReportReason } from '@/types';
import { notify } from '@/utils/dialog';
import { getErrorMessage } from '@/utils/errors';
import { goBack } from '@/utils/navigation';

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!reason) return;
    setSending(true);
    try {
      await api.users.report(id, reason, details);
      if (alsoBlock) await api.users.setBlocked(id, true);
      notify('Report sent', 'Thank you. Our safety team will review it within 24 hours.');
      if (alsoBlock) router.dismissTo('/');
      else goBack();
    } catch (e) {
      notify('Couldn’t send report', getErrorMessage(e));
      setSending(false);
    }
  };

  return (
    <Screen
      scroll
      keyboard
      padded={false}
      footer={
        <View style={styles.footer}>
          <Button title="Send report" variant="danger" onPress={submit} loading={sending} disabled={!reason} />
        </View>
      }
    >
      <Header title="Report" back="close" />
      <View style={styles.content}>
        <Text variant="body" color="muted">
          Reports are anonymous. Tell us what happened.
        </Text>

        <View style={styles.reasons}>
          {REPORT_REASONS.map((r) => {
            const active = r.value === reason;
            return (
              <Pressable
                key={r.value}
                onPress={() => setReason(r.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.reason, active && styles.reasonActive]}
              >
                <Icon name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.primary : colors.textFaint} />
                <Text variant="bodyStrong">{r.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextField
          label="Details (optional)"
          placeholder="Anything else we should know?"
          value={details}
          onChangeText={setDetails}
          maxLength={500}
          multiline
        />

        <View style={styles.blockRow}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">Also block this user</Text>
            <Text variant="caption" color="muted">
              They won’t be able to call you again.
            </Text>
          </View>
          <Switch
            value={alsoBlock}
            onValueChange={setAlsoBlock}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  reasons: { gap: spacing.sm },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  reasonActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  blockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  footer: { paddingHorizontal: spacing.lg },
});
