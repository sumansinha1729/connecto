import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Icon, Text } from '@/components/ui';
import { roomTheme } from '@/constants/roomThemes';
import { colors, radius, spacing } from '@/theme';
import type { Room } from '@/types';
import { liveFor } from './roomActions';

/** A room with this many people gets a "Trending" badge */
const TRENDING_AT = 10;

interface RoomCardProps {
  room: Room;
  /** You're in this room right now */
  joined?: boolean;
  onPress: () => void;
}

export function RoomCard({ room, joined, onPress }: RoomCardProps) {
  const theme = roomTheme(room.topic);
  const onStage = room.participants.filter((p) => p.role !== 'listener');
  const audience = room.participants.length - onStage.length;
  const names = onStage.slice(0, 2).map((p) => p.user.name).join(', ');
  const more = onStage.length > 2 ? ` +${onStage.length - 2}` : '';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]} accessibilityRole="button">
      <LinearGradient colors={theme.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, joined && { borderColor: theme.accent }]}>
        <View style={styles.topRow}>
          <View style={styles.live}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          {room.participants.length >= TRENDING_AT && (
            <View style={[styles.pill, { backgroundColor: colors.trendingSoft }]}>
              <Text style={[styles.pillText, { color: colors.trending }]}>🔥 Trending</Text>
            </View>
          )}
          {joined && (
            <View style={[styles.pill, { backgroundColor: colors.glassStrong }]}>
              <Text style={[styles.pillText, { color: theme.accent }]}>You’re here</Text>
            </View>
          )}
          <View style={styles.flex} />
          <Text style={styles.emoji}>{theme.emoji}</Text>
        </View>

        <View style={styles.titles}>
          <Text variant="heading" numberOfLines={2}>
            {room.title}
          </Text>
          {room.description ? (
            <Text variant="caption" color="muted" numberOfLines={1}>
              {room.description}
            </Text>
          ) : null}
        </View>

        <View style={styles.stageRow}>
          <View style={styles.avatars}>
            {onStage.slice(0, 4).map((p, i) => (
              <View key={p.user.id} style={[styles.avatarWrap, { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }]}>
                <Avatar avatar={p.user.avatar} size={30} />
              </View>
            ))}
          </View>
          <Text variant="caption" numberOfLines={1} style={styles.names}>
            {names}
            {more}
            <Text variant="caption" color="muted">
              {' '}
              on stage
            </Text>
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={[styles.pill, { backgroundColor: colors.glassSubtle }]}>
            <Text style={[styles.pillText, { color: theme.accent }]}>{room.topic}</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: colors.glassSubtle }]}>
            <Text style={[styles.pillText, { color: colors.textMuted }]}>{room.language}</Text>
          </View>
          <View style={styles.flex} />
          <Icon name="headset" size={13} color={colors.textMuted} />
          <Text variant="caption" color="muted">
            {audience} · {liveFor(room.createdAt)}
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassSubtle,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.dangerSoft,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  liveText: { color: colors.danger, fontWeight: '800', fontSize: 10, letterSpacing: 0.5 },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '700' },
  emoji: { fontSize: 26 },
  titles: { gap: 2 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatars: { flexDirection: 'row' },
  avatarWrap: { borderRadius: 17, borderWidth: 2, borderColor: colors.shadeStrong },
  names: { flex: 1, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  flex: { flex: 1 },
});
