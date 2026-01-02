import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { StatusBadge } from '@/components/admin/StatusBadge';
import { Avatar, EmptyState, Header, LoadingView, Screen, Text, TextField } from '@/components/ui';
import { adminApi } from '@/services/http/admin';
import { colors, spacing } from '@/theme';
import type { AdminUser } from '@/types/admin';
import { getErrorMessage } from '@/utils/errors';

export default function AdminUsersScreen() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search as you type, after a short pause
  useEffect(() => {
    let active = true;
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const result = await adminApi.searchUsers(query.trim());
        if (active) {
          setUsers(result);
          setError(null);
        }
      } catch (e) {
        if (active) setError(getErrorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [query]);

  return (
    <Screen padded={false}>
      <Header title="Users" />
      <View style={styles.search}>
        <TextField placeholder="Search by name or phone number" value={query} onChangeText={setQuery} autoFocus autoCorrect={false} />
      </View>
      <FlatList
        data={users ?? []}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/admin/user/${item.id}`)}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
          >
            <Avatar avatar={item.avatar} size={44} online={item.isOnline} />
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {item.name || 'No name yet'}
              </Text>
              <Text variant="caption" color="muted">
                {item.phone}
              </Text>
            </View>
            {item.status !== 'active' && <StatusBadge label={item.status} tone={item.status} />}
            {item.listenerStatus === 'pending' && <StatusBadge label="applied" tone="pending" />}
            {item.role === 'listener' && <StatusBadge label="listener" tone="listener" />}
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? (
            <LoadingView />
          ) : error ? (
            <EmptyState icon="cloud-offline" title="Couldn’t search" message={error} />
          ) : (
            <EmptyState icon="search" title="No users found" />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  flex: { flex: 1 },
});
