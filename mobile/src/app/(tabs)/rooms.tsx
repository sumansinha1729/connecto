import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { RoomCard } from '@/components/rooms/RoomCard';
import { Button, EmptyState, LoadingView, Screen, Text } from '@/components/ui';
import { useAsyncData } from '@/hooks/useAsyncData';
import { api } from '@/services';
import { selectIsListener, useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';

export default function RoomsScreen() {
  const isListener = useAuthStore(selectIsListener);
  const { data: rooms, loading, refreshing, error, refresh } = useAsyncData(() => api.rooms.listRooms(), [], {
    refetchOnFocus: true,
  });

  return (
    <Screen padded={false} edges={['top']}>
      <FlatList
        data={rooms ?? []}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <RoomCard room={item} onPress={() => router.push(`/room/${item.id}`)} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="title">Voice rooms</Text>
            <Text variant="body" color="muted">
              {isListener ? 'Host a room or drop into one.' : 'Drop in, listen, and raise your hand to speak.'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingView />
          ) : error ? (
            <EmptyState icon="cloud-offline" title="Couldn’t load rooms" message={error} actionLabel="Retry" onAction={refresh} />
          ) : (
            <EmptyState icon="mic" title="No live rooms" message="Be the first to start a conversation." />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
      {isListener && (
        <View style={styles.fab}>
          <Button title="Start a room" icon="add" onPress={() => router.push('/room/create')} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  header: { gap: spacing.xs, paddingTop: spacing.md, paddingBottom: spacing.lg },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg },
});
