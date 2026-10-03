import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, IconButton, Text } from '@/components/ui';
import { roomTheme } from '@/constants/roomThemes';
import { useAuthStore } from '@/store/authStore';
import { canSpeakIn, findParticipant, useRoomStore } from '@/store/roomStore';
import { useVoiceStore } from '@/store/voiceStore';
import { colors, radius, spacing } from '@/theme';
import { leaveRoomWithConfirm } from './roomActions';

/** Shown above the tab bar while you're in a room but browsing elsewhere in the app */
export function MiniPlayer({ bottom }: { bottom: number }) {
  const room = useRoomStore((s) => s.room);
  const meId = useAuthStore((s) => s.user?.id);
  const speakingUids = useVoiceStore((s) => s.speakingUids);
  const pathname = usePathname();

  if (!room || pathname.startsWith('/room/')) return null;

  const theme = roomTheme(room.topic);
  const me = findParticipant(room, meId);
  const talking = room.participants.filter((p) => speakingUids.includes(p.voiceUid) && p.user.id !== meId).map((p) => p.user.name);
  const subtitle = talking.length ? `${talking.slice(0, 2).join(', ')} talking…` : `${room.participants.length} in the room`;
  const toggleMic = () => me && useRoomStore.getState().setMuted(!me.isMuted).catch(() => {});

  return (
    <View style={[styles.wrap, { bottom }]}>
      <LinearGradient colors={theme.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bar}>
        {/* Only this part opens the room, so the buttons aren't nested inside another button */}
        <Pressable
          onPress={() => router.push(`/room/${room.id}`)}
          style={styles.open}
          accessibilityRole="button"
          accessibilityLabel={`Back to room ${room.title}`}
        >
          <View style={[styles.emoji, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
            <Text style={styles.emojiText}>{theme.emoji}</Text>
          </View>
          <View style={styles.flex}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {room.title}
            </Text>
            <View style={styles.subtitle}>
              {talking.length > 0 && <Icon name="volume-high" size={12} color={theme.accent} />}
              <Text variant="caption" color="muted" numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          </View>
        </Pressable>
        {me && canSpeakIn(me.role) && (
          <IconButton
            icon={me.isMuted ? 'mic-off' : 'mic'}
            size={38}
            color={colors.white}
            background={me.isMuted ? 'rgba(255,255,255,0.12)' : theme.accent}
            onPress={toggleMic}
            accessibilityLabel={me.isMuted ? 'Unmute' : 'Mute'}
          />
        )}
        <IconButton
          icon="close"
          size={38}
          color={colors.white}
          background="rgba(255,255,255,0.12)"
          onPress={() => leaveRoomWithConfirm(meId)}
          accessibilityLabel="Leave room"
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  emoji: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 20 },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  subtitle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
