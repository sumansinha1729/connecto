import { StyleSheet, View } from 'react-native';

import { Avatar, Card, Chip, Icon, Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { Room } from '@/types';

interface RoomCardProps {
  room: Room;
  onPress: () => void;
}

export function RoomCard({ room, onPress }: RoomCardProps) {
  const onStage = room.participants.filter((p) => p.role !== 'listener');
  const listeners = room.participants.length - onStage.length;
  const names = onStage.slice(0, 2).map((p) => p.user.name).join(', ');
  const more = onStage.length > 2 ? ` +${onStage.length - 2}` : '';

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.tags}>
        <View style={styles.live}>
          <View style={styles.liveDot} />
          <Text variant="caption" style={styles.liveText}>
            LIVE
          </Text>
        </View>
        <Chip label={room.topic} />
        <Chip label={room.language} icon="language" />
      </View>

      <Text variant="heading" numberOfLines={2}>
        {room.title}
      </Text>

      <View style={styles.footer}>
        <View style={styles.avatars}>
          {onStage.slice(0, 4).map((p, i) => (
            <View key={p.user.id} style={[styles.avatarWrap, { marginLeft: i === 0 ? 0 : -12, zIndex: 10 - i }]}>
              <Avatar avatar={p.user.avatar} size={32} />
            </View>
          ))}
        </View>
        <Text variant="caption" color="muted" numberOfLines={1} style={styles.names}>
          {names}
          {more}
        </Text>
        <View style={styles.count}>
          <Icon name="headset" size={14} color={colors.textMuted} />
          <Text variant="caption" color="muted">
            {listeners}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  tags: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.dangerSoft,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  liveText: { color: colors.danger, fontWeight: '800', fontSize: 11 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatars: { flexDirection: 'row' },
  avatarWrap: { borderRadius: 18, borderWidth: 2, borderColor: colors.surface },
  names: { flex: 1 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
