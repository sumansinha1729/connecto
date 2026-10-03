import { useEffect, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { RoomMessage } from '@/types';

interface RoomChatProps {
  messages: RoomMessage[];
  meId: string | undefined;
  accent: string;
  /** Long-press on a message (e.g. to delete it) */
  onMessageAction?: (message: RoomMessage) => void;
}

/** Messages within this time from the same person are grouped under one avatar and name */
const GROUP_MS = 2 * 60_000;

function startsGroup(messages: RoomMessage[], index: number): boolean {
  const m = messages[index];
  const prev = messages[index - 1];
  return !prev || prev.kind !== 'chat' || prev.user?.id !== m.user?.id || Date.parse(m.createdAt) - Date.parse(prev.createdAt) > GROUP_MS;
}

/** The room's live chat, messenger style: yours on the right, others on the left. Newest at the bottom. */
export function RoomChat({ messages, meId, accent, onMessageAction }: RoomChatProps) {
  const list = useRef<FlatList<RoomMessage>>(null);

  // Keep the newest message in view
  useEffect(() => {
    const id = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [messages.length]);

  return (
    <FlatList
      ref={list}
      data={messages}
      keyExtractor={(m) => m.id}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text variant="caption" color="muted" center>
            💬 You’ll see messages sent from now on. Say hi!
          </Text>
        </View>
      }
      renderItem={({ item, index }) => {
        if (item.kind !== 'chat') {
          return (
            <View style={styles.eventRow}>
              <View style={[styles.event, item.kind === 'system' && { backgroundColor: colors.glass }]}>
                <Text variant="caption" style={item.kind === 'system' ? [styles.systemText, { color: accent }] : styles.joinText}>
                  {item.kind === 'join' ? `${item.user?.id === meId ? 'You' : (item.user?.name ?? 'Someone')} joined 👋` : item.text}
                </Text>
              </View>
            </View>
          );
        }

        const mine = item.user?.id === meId;
        const first = startsGroup(messages, index);
        const longPress = onMessageAction ? () => onMessageAction(item) : undefined;

        if (mine) {
          return (
            <Pressable onLongPress={longPress} delayLongPress={350} style={[styles.mineRow, first && styles.groupGap]}>
              <View style={[styles.bubble, styles.mineBubble, { backgroundColor: accent }]}>
                <Text variant="body" style={styles.mineText}>
                  {item.text}
                </Text>
              </View>
            </Pressable>
          );
        }

        return (
          <Pressable onLongPress={longPress} delayLongPress={350} style={[styles.theirRow, first && styles.groupGap]}>
            {first ? <Avatar avatar={item.user?.avatar ?? 'adventurer:x'} size={28} /> : <View style={styles.avatarSpace} />}
            <View style={styles.theirColumn}>
              {first && (
                <Text variant="caption" style={styles.name} numberOfLines={1}>
                  {item.user?.name ?? 'Someone'}
                </Text>
              )}
              <View style={[styles.bubble, styles.theirBubble]}>
                <Text variant="body" style={styles.text}>
                  {item.text}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.sm, gap: 4 },
  empty: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xl },
  groupGap: { marginTop: spacing.sm },
  eventRow: { alignItems: 'center', marginVertical: 2 },
  event: { paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: 999 },
  joinText: { color: colors.textFaint, fontSize: 12 },
  systemText: { fontWeight: '700', fontSize: 12 },
  theirRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingRight: 48 },
  avatarSpace: { width: 28 },
  theirColumn: { flexShrink: 1, gap: 2 },
  name: { color: colors.textMuted, fontWeight: '700', fontSize: 11, marginLeft: spacing.sm },
  mineRow: { alignItems: 'flex-end', paddingLeft: 64 },
  bubble: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: 16 },
  theirBubble: { backgroundColor: colors.glass, borderBottomLeftRadius: 4, alignSelf: 'flex-start' },
  mineBubble: { borderBottomRightRadius: 4 },
  text: { fontSize: 14, lineHeight: 19, color: colors.text },
  // Dark text: the theme accents are light colours
  mineText: { fontSize: 14, lineHeight: 19, color: colors.textOnLight, fontWeight: '500' },
});
