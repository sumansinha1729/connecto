import { FlatList, StyleSheet, View } from 'react-native';

import { Avatar, Button, EmptyState, Header, LoadingView, Screen, Text } from '@/components/ui';
import { useAsyncData } from '@/hooks/useAsyncData';
import { api } from '@/services';
import { colors, spacing } from '@/theme';
import { confirm, notify } from '@/utils/dialog';
import { getErrorMessage } from '@/utils/errors';

export default function BlockedScreen() {
  const { data: users, setData, loading, error, refresh } = useAsyncData(() => api.users.listBlocked(), []);

  const unblock = async (userId: string, name: string) => {
    const ok = await confirm({
      title: `Unblock ${name}?`,
      message: 'You’ll be able to see each other again, and calls between you will be allowed.',
      confirmText: 'Unblock',
    });
    if (!ok) return;
    try {
      await api.users.setBlocked(userId, false);
      setData((users ?? []).filter((u) => u.id !== userId));
    } catch (e) {
      notify('Couldn’t unblock', getErrorMessage(e));
    }
  };

  return (
    <Screen padded={false}>
      <Header title="Blocked users" />
      <FlatList
        data={users ?? []}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar avatar={item.avatar} size={44} />
            <Text variant="bodyStrong" style={styles.name}>
              {item.name}
            </Text>
            <Button title="Unblock" variant="secondary" size="sm" onPress={() => unblock(item.id, item.name)} />
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <LoadingView />
          ) : error ? (
            <EmptyState icon="cloud-offline" title="Couldn’t load" message={error} actionLabel="Retry" onAction={refresh} />
          ) : (
            <EmptyState icon="shield-checkmark" title="No blocked users" message="People you block will appear here." />
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  name: { flex: 1 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 76 },
});
