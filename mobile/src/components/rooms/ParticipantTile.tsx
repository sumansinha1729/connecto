import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Icon, Text } from '@/components/ui';
import { colors } from '@/theme';
import type { RoomParticipant } from '@/types';

interface ParticipantTileProps {
  participant: RoomParticipant;
  speaking: boolean;
  isMe: boolean;
  size: number;
  onPress?: () => void;
}

export function ParticipantTile({ participant, speaking, isMe, size, onPress }: ParticipantTileProps) {
  const { user, role, isMuted, handRaised } = participant;
  const onStage = role !== 'listener';

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.tile, { width: size + 16 }]}>
      <View>
        <Avatar avatar={user.avatar} size={size} ring={speaking} />
        {onStage && isMuted && (
          <View style={[styles.badge, styles.badgeRight]}>
            <Icon name="mic-off" size={12} color={colors.white} />
          </View>
        )}
        {handRaised && (
          <View style={[styles.badge, styles.badgeLeft, { backgroundColor: colors.warning }]}>
            <Icon name="hand-left" size={12} color={colors.white} />
          </View>
        )}
      </View>
      <View style={styles.nameRow}>
        {role === 'host' && <Icon name="star" size={11} color={colors.coin} />}
        <Text variant="caption" numberOfLines={1} style={styles.name}>
          {isMe ? 'You' : user.name}
        </Text>
      </View>
      {role === 'host' && (
        <Text variant="caption" color="faint" style={styles.role}>
          Host
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', gap: 4 },
  badge: {
    position: 'absolute',
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeRight: { right: -2 },
  badgeLeft: { left: -2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%' },
  name: { fontWeight: '600', flexShrink: 1 },
  role: { fontSize: 11, marginTop: -4 },
});
