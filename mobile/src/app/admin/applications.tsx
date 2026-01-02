import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { VoicePlayer } from '@/components/listener/VoicePlayer';
import { Avatar, Button, Card, EmptyState, FormSheet, Header, LoadingView, Screen, Text } from '@/components/ui';
import { useAsyncData } from '@/hooks/useAsyncData';
import { adminApi } from '@/services/http/admin';
import { colors, spacing } from '@/theme';
import type { AdminUser } from '@/types/admin';
import { notify } from '@/utils/dialog';
import { getErrorMessage } from '@/utils/errors';
import { formatAgeGender, formatDateOfBirth, formatRelativeTime } from '@/utils/format';

export default function ListenerApplicationsScreen() {
  const { data, setData, loading, refreshing, error, refresh } = useAsyncData(() => adminApi.listApplications(), []);
  const [rejecting, setRejecting] = useState<AdminUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const removeFromList = (id: string) => setData((data ?? []).filter((u) => u.id !== id));

  const approve = async (user: AdminUser) => {
    setBusyId(user.id);
    try {
      await adminApi.approveListener(user.id);
      removeFromList(user.id);
    } catch (e) {
      notify('Couldn’t approve', getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen padded={false}>
      <Header title="Listener applications" />
      <FlatList
        data={data ?? []}
        keyExtractor={(u) => u.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <Avatar avatar={item.avatar} size={48} />
              <View style={styles.flex}>
                <Text variant="bodyStrong">{item.name}</Text>
                <Text variant="caption" color="muted">
                  {formatAgeGender(item.age, item.gender)} · {item.languages.join(', ')}
                </Text>
                {item.listenerApplication.appliedAt && (
                  <Text variant="caption" color="faint">
                    Applied {formatRelativeTime(item.listenerApplication.appliedAt)}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.details}>
              <Detail label="Full name" value={item.listenerApplication.fullName} />
              <Detail label="Date of birth" value={formatDateOfBirth(item.listenerApplication.dateOfBirth)} />
              <Detail label="City" value={item.listenerApplication.city} />
            </View>
            <Text variant="body" style={styles.about}>
              “{item.listenerApplication.about}”
            </Text>
            {item.listenerApplication.voiceIntroUrl && (
              <VoicePlayer
                key={item.listenerApplication.voiceIntroUrl}
                uri={item.listenerApplication.voiceIntroUrl}
                fallbackDurationSec={item.listenerApplication.voiceIntroDurationSec}
              />
            )}
            <View style={styles.row}>
              <Button title="Reject" variant="secondary" size="sm" onPress={() => setRejecting(item)} style={styles.flex} />
              <Button title="Approve" size="sm" icon="checkmark" loading={busyId === item.id} onPress={() => approve(item)} style={styles.flex} />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          loading ? (
            <LoadingView />
          ) : error ? (
            <EmptyState icon="cloud-offline" title="Couldn’t load" message={error} actionLabel="Retry" onAction={refresh} />
          ) : (
            <EmptyState icon="checkmark-done" title="All caught up" message="No applications waiting for review." />
          )
        }
      />

      <FormSheet
        visible={rejecting !== null}
        title={`Reject ${rejecting?.name ?? ''}?`}
        message="They can apply again later."
        fields={[{ key: 'note', label: 'Reason', placeholder: 'e.g. Please complete your bio first', minLength: 3 }]}
        submitLabel="Reject"
        destructive
        onClose={() => setRejecting(null)}
        onSubmit={async ({ note }) => {
          if (!rejecting) return;
          await adminApi.rejectListener(rejecting.id, note);
          removeFromList(rejecting.id);
        }}
      />
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.detail}>
      <Text variant="caption" color="faint">
        {label}
      </Text>
      <Text variant="caption" style={styles.detailValue}>
        {value ?? '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  details: { gap: 4 },
  detail: { flexDirection: 'row', gap: spacing.sm },
  detailValue: { flex: 1, fontWeight: '600' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  about: { fontStyle: 'italic' },
});
