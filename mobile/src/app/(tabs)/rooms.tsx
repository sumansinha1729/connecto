import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { RoomCard } from '@/components/rooms/RoomCard';
import { Button, EmptyState, LoadingView, Screen, Text } from '@/components/ui';
import { ROOM_TOPICS } from '@/constants/options';
import { roomTheme } from '@/constants/roomThemes';
import { useAsyncData } from '@/hooks/useAsyncData';
import { api } from '@/services';
import { selectIsListener, useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { colors, radius, spacing } from '@/theme';

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text variant="caption" style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function RoomsScreen() {
  const isListener = useAuthStore(selectIsListener);
  const currentRoomId = useRoomStore((s) => s.room?.id);
  const [topic, setTopic] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const { data: rooms, loading, refreshing, error, refresh } = useAsyncData(() => api.rooms.listRooms(), [], {
    refetchOnFocus: true,
  });

  // Only offer languages that some live room actually uses
  const languages = useMemo(() => [...new Set((rooms ?? []).map((r) => r.language))].sort(), [rooms]);
  const shown = (rooms ?? []).filter((r) => (!topic || r.topic === topic) && (!language || r.language === language));
  const listening = (rooms ?? []).reduce((n, r) => n + r.participants.length, 0);

  return (
    <Screen padded={false} edges={['top']}>
      <FlatList
        data={shown}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <RoomCard room={item} joined={item.id === currentRoomId} onPress={() => router.push(`/room/${item.id}`)} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text variant="title">Voice rooms</Text>
              {rooms && rooms.length > 0 && (
                <View style={styles.liveCount}>
                  <View style={styles.liveDot} />
                  <Text variant="caption" style={styles.liveCountText}>
                    {rooms.length} live · {listening} {listening === 1 ? 'person' : 'people'}
                  </Text>
                </View>
              )}
            </View>
            <Text variant="body" color="muted">
              {isListener ? 'Host a room or drop into one.' : 'Drop in, listen, and raise your hand to speak.'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
              <FilterChip label="All" active={!topic} onPress={() => setTopic(null)} />
              {ROOM_TOPICS.map((t) => (
                <FilterChip key={t} label={`${roomTheme(t).emoji} ${t}`} active={topic === t} onPress={() => setTopic(topic === t ? null : t)} />
              ))}
            </ScrollView>
            {languages.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
                <FilterChip label="Any language" active={!language} onPress={() => setLanguage(null)} />
                {languages.map((l) => (
                  <FilterChip key={l} label={l} active={language === l} onPress={() => setLanguage(language === l ? null : l)} />
                ))}
              </ScrollView>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingView />
          ) : error ? (
            <EmptyState icon="cloud-offline" title="Couldn’t load rooms" message={error} actionLabel="Retry" onAction={refresh} />
          ) : topic || language ? (
            <EmptyState
              icon="search"
              title="No rooms match"
              message="Try another topic or language."
              actionLabel="Show all rooms"
              onAction={() => {
                setTopic(null);
                setLanguage(null);
              }}
            />
          ) : (
            <EmptyState icon="mic" title="No live rooms" message={isListener ? 'Be the first to start a conversation.' : 'Check back soon, or pull down to refresh.'} />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
      {isListener && (
        // Sits above the mini-player while you're in a room
        <View style={[styles.fab, currentRoomId && styles.fabRaised]}>
          <Button title="Start a room" icon="add" onPress={() => router.push('/room/create')} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: 170 },
  header: { gap: spacing.xs, paddingTop: spacing.md, paddingBottom: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  liveCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.dangerSoft,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  liveCountText: { color: colors.text, fontWeight: '700' },
  chipScroll: { marginHorizontal: -spacing.lg, marginTop: spacing.sm },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: colors.text },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg },
  fabRaised: { bottom: spacing.lg + 72 },
});
