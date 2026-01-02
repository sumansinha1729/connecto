import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ParticipantTile } from '@/components/rooms/ParticipantTile';
import {
  ActionSheet,
  Avatar,
  Button,
  Chip,
  EmptyState,
  Header,
  Icon,
  IconButton,
  LoadingView,
  Text,
  type SheetAction,
} from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { findParticipant, useRoomStore } from '@/store/roomStore';
import { colors, radius, spacing } from '@/theme';
import type { RoomParticipant } from '@/types';
import { confirm, notify } from '@/utils/dialog';
import { getErrorMessage } from '@/utils/errors';
import { goBack } from '@/utils/navigation';

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const meId = useAuthStore((s) => s.user?.id);
  const { room, speakingIds, exitReason } = useRoomStore();
  const actions = useRoomStore.getState();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RoomParticipant | null>(null);

  // Join on open, leave on close
  useEffect(() => {
    let active = true;
    useRoomStore
      .getState()
      .join(id)
      .catch((e) => active && setError(getErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      useRoomStore.getState().leave().catch(() => {});
    };
  }, [id]);

  // The host ended the room, or you were removed
  useEffect(() => {
    if (!exitReason) return;
    notify(exitReason === 'closed' ? 'Room ended' : 'Removed from room', exitReason === 'closed' ? 'The host has ended this room.' : 'The host removed you from this room.');
    goBack();
  }, [exitReason]);

  const me = findParticipant(room, meId);
  const isHost = Boolean(room && room.hostId === meId);

  const leave = useCallback(async () => {
    if (isHost) {
      const ok = await confirm({
        title: 'End room?',
        message: 'You’re the host. Leaving will end the room for everyone.',
        confirmText: 'End room',
        destructive: true,
      });
      if (!ok) return;
    }
    goBack();
  }, [isHost]);

  // Android back button: confirm before the host ends the room
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isHost) return false;
      leave();
      return true;
    });
    return () => sub.remove();
  }, [isHost, leave]);

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (e) {
      notify('Something went wrong', getErrorMessage(e));
    }
  };

  if (loading || !room) {
    return (
      <SafeAreaView style={styles.root}>
        <Header back="close" />
        {error ? <EmptyState icon="mic-off" title="Can’t join this room" message={error} /> : <LoadingView />}
      </SafeAreaView>
    );
  }

  const stage = room.participants
    .filter((p) => p.role !== 'listener')
    .sort((a, b) => Number(b.role === 'host') - Number(a.role === 'host'));
  const audience = room.participants.filter((p) => p.role === 'listener');
  const raisedHands = audience.filter((p) => p.handRaised);

  const sheetActions = (p: RoomParticipant): SheetAction[] => {
    const list: SheetAction[] = [
      { label: 'View profile', icon: 'person', onPress: () => router.push(`/user/${p.user.id}`) },
    ];
    if (isHost) {
      list.push(
        p.role === 'listener'
          ? { label: 'Invite to speak', icon: 'mic', onPress: () => run(() => actions.setRole(p.user.id, 'speaker')) }
          : { label: 'Move to audience', icon: 'headset', onPress: () => run(() => actions.setRole(p.user.id, 'listener')) },
        { label: 'Remove from room', icon: 'exit', destructive: true, onPress: () => run(() => actions.removeParticipant(p.user.id)) },
      );
    }
    return list;
  };

  const onTilePress = (p: RoomParticipant) => {
    if (p.user.id !== meId) setSelected(p);
  };

  return (
    <SafeAreaView style={styles.root}>
      <Header
        back="close"
        onBack={leave}
        title={room.topic}
        right={
          <View style={styles.count}>
            <Icon name="people" size={16} color={colors.textMuted} />
            <Text variant="caption" color="muted">
              {room.participants.length}
            </Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text variant="title">{room.title}</Text>
          <View style={styles.tags}>
            <Chip label={room.language} icon="language" />
          </View>
        </View>

        <Text variant="label" color="muted">
          On stage
        </Text>
        <View style={styles.grid}>
          {stage.map((p) => (
            <ParticipantTile
              key={p.user.id}
              participant={p}
              speaking={speakingIds.includes(p.user.id) || (p.user.id === meId && !p.isMuted)}
              isMe={p.user.id === meId}
              size={72}
              onPress={() => onTilePress(p)}
            />
          ))}
        </View>

        {isHost && raisedHands.length > 0 && (
          <View style={styles.hands}>
            <Text variant="label" color="muted">
              Raised hands
            </Text>
            {raisedHands.map((p) => (
              <View key={p.user.id} style={styles.handRow}>
                <Avatar avatar={p.user.avatar} size={36} />
                <Text variant="bodyStrong" style={styles.handName} numberOfLines={1}>
                  {p.user.name}
                </Text>
                <Button title="Invite" size="sm" onPress={() => run(() => actions.setRole(p.user.id, 'speaker'))} />
                <IconButton
                  icon="close"
                  size={36}
                  onPress={() => run(() => actions.setRole(p.user.id, 'listener'))}
                  accessibilityLabel={`Lower ${p.user.name}'s hand`}
                />
              </View>
            ))}
          </View>
        )}

        <Text variant="label" color="muted">
          Listening · {audience.length}
        </Text>
        <View style={styles.grid}>
          {audience.map((p) => (
            <ParticipantTile
              key={p.user.id}
              participant={p}
              speaking={false}
              isMe={p.user.id === meId}
              size={56}
              onPress={() => onTilePress(p)}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button title={isHost ? 'End room' : 'Leave quietly'} variant="secondary" size="sm" icon="exit-outline" onPress={leave} />
        <View style={styles.flex} />
        {me?.role === 'listener' && (
          <IconButton
            icon="hand-left"
            size={52}
            color={me.handRaised ? colors.white : colors.text}
            background={me.handRaised ? colors.warning : colors.surfaceAlt}
            onPress={() => run(() => actions.setHandRaised(!me.handRaised))}
            accessibilityLabel={me.handRaised ? 'Lower hand' : 'Raise hand to speak'}
          />
        )}
        {me && me.role !== 'listener' && (
          <IconButton
            icon={me.isMuted ? 'mic-off' : 'mic'}
            size={52}
            color={colors.white}
            background={me.isMuted ? colors.surfaceAlt : colors.primary}
            onPress={() => run(() => actions.setMuted(!me.isMuted))}
            accessibilityLabel={me.isMuted ? 'Unmute' : 'Mute'}
          />
        )}
      </View>

      <ActionSheet
        visible={selected !== null}
        title={selected?.user.name}
        actions={selected ? sheetActions(selected) : []}
        onClose={() => setSelected(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  titleBlock: { gap: spacing.sm },
  tags: { flexDirection: 'row', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  hands: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  handRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  handName: { flex: 1 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
