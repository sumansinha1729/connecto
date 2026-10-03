import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { colors } from '@/theme';
import type { RoomParticipant } from '@/types';
import { SpeakingAvatar } from './SpeakingAvatar';

interface ParticipantTileProps {
  participant: RoomParticipant;
  speaking: boolean;
  isMe: boolean;
  size: number;
  /** Room theme accent, used for the speaking rings */
  accent: string;
  onPress?: () => void;
}

const ROLE_LABEL = { host: 'Host', cohost: 'Co-host', speaker: null, listener: null } as const;

export function ParticipantTile({ participant, speaking, isMe, size, accent, onPress }: ParticipantTileProps) {
  const { user, role, isMuted, handRaised } = participant;
  const onStage = role !== 'listener';
  const label = ROLE_LABEL[role];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.tile, { width: size + 20 }]}
      accessibilityLabel={`${isMe ? 'You' : user.name}${label ? `, ${label}` : ''}${onStage && isMuted ? ', muted' : ''}`}
    >
      <View>
        <SpeakingAvatar avatar={user.avatar} size={size} speaking={speaking} color={accent} />
        {role === 'host' && (
          <View style={styles.crown}>
            <Text style={styles.crownText}>👑</Text>
          </View>
        )}
        {onStage && isMuted && (
          <View style={[styles.badge, styles.badgeRight]}>
            <Icon name="mic-off" size={11} color={colors.white} />
          </View>
        )}
        {handRaised && (
          <View style={[styles.badge, styles.badgeLeft, { backgroundColor: colors.warning }]}>
            <Text style={styles.hand}>✋</Text>
          </View>
        )}
      </View>
      <Text variant="caption" numberOfLines={1} style={styles.name}>
        {isMe ? 'You' : user.name}
      </Text>
      {label && (
        <Text variant="caption" style={[styles.role, { color: accent }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', gap: 2 },
  name: { color: colors.text, fontWeight: '600', marginTop: 4, maxWidth: '100%' },
  role: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  crown: { position: 'absolute', top: -12, alignSelf: 'center' },
  crownText: { fontSize: 18 },
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
  badgeRight: { right: 0 },
  badgeLeft: { left: 0 },
  hand: { fontSize: 11 },
});
