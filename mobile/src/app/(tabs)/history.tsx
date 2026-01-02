import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { CallRow } from '@/components/calls/CallRow';
import { EmptyState, LoadingView, Screen, Text } from '@/components/ui';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useStartCall } from '@/hooks/useStartCall';
import { api } from '@/services';
import { selectIsListener, useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';

export default function HistoryScreen() {
  const startCall = useStartCall();
  const isListener = useAuthStore(selectIsListener);
  const { data: calls, loading, refreshing, error, refresh } = useAsyncData(() => api.calls.getHistory(), [], {
    refetchOnFocus: true,
  });

  return (
    <Screen padded={false} edges={['top']}>
      <FlatList
        data={calls ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <CallRow
            call={item}
            onPress={() => router.push(`/user/${item.peer.id}`)}
            onCallBack={isListener ? undefined : () => startCall(item.peer)}
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="title">Calls</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingView />
          ) : error ? (
            <EmptyState icon="cloud-offline" title="Couldn’t load calls" message={error} actionLabel="Retry" onAction={refresh} />
          ) : (
            <EmptyState
              icon="call"
              title="No calls yet"
              message="Your call history will show up here."
              actionLabel="Find someone to talk to"
              onAction={() => router.push('/')}
            />
          )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
});
