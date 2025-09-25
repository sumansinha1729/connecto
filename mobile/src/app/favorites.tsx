import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { EmptyState, Header, LoadingView, Screen } from '@/components/ui';
import { UserCard } from '@/components/users/UserCard';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useStartCall } from '@/hooks/useStartCall';
import { api } from '@/services';
import { spacing } from '@/theme';

export default function FavoritesScreen() {
  const startCall = useStartCall();
  const { data: users, loading, error, refresh } = useAsyncData(() => api.users.listFavorites(), [], {
    refetchOnFocus: true,
  });

  return (
    <Screen padded={false}>
      <Header title="Favourites" />
      <FlatList
        data={users ?? []}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <UserCard user={item} onPress={() => router.push(`/user/${item.id}`)} onCall={() => startCall(item)} />
        )}
        ListEmptyComponent={
          loading ? (
            <LoadingView />
          ) : error ? (
            <EmptyState icon="cloud-offline" title="Couldn’t load favourites" message={error} actionLabel="Retry" onAction={refresh} />
          ) : (
            <EmptyState icon="heart" title="No favourites yet" message="Tap the heart on someone’s profile to save them here." />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={styles.list}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
});
