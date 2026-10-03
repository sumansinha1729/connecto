import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingReactions } from '@/components/rooms/FloatingReactions';
import { ParticipantTile } from '@/components/rooms/ParticipantTile';
import { leaveRoomWithConfirm, liveFor } from '@/components/rooms/roomActions';
import { RoomChat } from '@/components/rooms/RoomChat';
import { ActionSheet, Avatar, Button, EmptyState, FormSheet, Icon, IconButton, LoadingView, Text, type SheetAction } from '@/components/ui';
import { roomTheme } from '@/constants/roomThemes';
import { useAuthStore } from '@/store/authStore';
import { canSpeakIn, findParticipant, isModerator, useRoomStore } from '@/store/roomStore';
import { useVoiceStore } from '@/store/voiceStore';
import { colors, radius, spacing } from '@/theme';
import { ROOM_REACTIONS, type RoomMessage, type RoomParticipant } from '@/types';
import { notify } from '@/utils/dialog';
import { getErrorMessage } from '@/utils/errors';
import { goBack } from '@/utils/navigation';

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const meId = useAuthStore((s) => s.user?.id);
  const { room, voice, messages, reactions, notice, exitReason } = useRoomStore();
  const actions = useRoomStore.getState();
  const speakingUids = useVoiceStore((s) => s.speakingUids);
  const voiceStatus = useVoiceStore((s) => s.status);
  const voiceMessage = useVoiceStore((s) => s.message);
  const { height } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RoomParticipant | null>(null);
  const [messageAction, setMessageAction] = useState<RoomMessage | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // Join on open. Closing the screen only minimises the room (mini-player); "Leave" leaves it.
  useEffect(() => {
    let active = true;
    useRoomStore
      .getState()
      .join(id)
      .catch((e) => active && setError(getErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (e) {
      notify('Something went wrong', getErrorMessage(e));
    }
  };

  const leave = async () => {
    if (await leaveRoomWithConfirm(meId)) goBack();
  };

  if (loading || !room) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <IconButton icon="chevron-down" onPress={goBack} size={40} background="transparent" accessibilityLabel="Close" />
        </View>
        {exitReason === 'call' ? (
          <EmptyState icon="call" title="You left this room" message="You can only be in one voice chat at a time, so joining your call took you out of the room." />
        ) : error ? (
          <EmptyState icon="mic-off" title="Can’t join this room" message={error} />
        ) : (
          <LoadingView />
        )}
      </SafeAreaView>
    );
  }

  const theme = roomTheme(room.topic);
  const me = findParticipant(room, meId);
  const moderator = isModerator(me?.role);
  const iAmHost = me?.role === 'host';
  const stage = room.participants.filter((p) => p.role !== 'listener');
  const host = stage.find((p) => p.role === 'host');
  const others = stage.filter((p) => p.role !== 'host');
  const audience = room.participants.filter((p) => p.role === 'listener');
  const raisedHands = audience.filter((p) => p.handRaised);
  // Without voice (Agora not set up) an unmuted speaker counts as talking
  const isSpeaking = (p: RoomParticipant) => (voice ? speakingUids.includes(p.voiceUid) : p.user.id === meId && !p.isMuted);
  const banner = notice ?? (voiceStatus === 'reconnecting' ? 'Reconnecting audio…' : voiceMessage);

  const participantActions = (p: RoomParticipant): SheetAction[] => {
    const list: SheetAction[] = [];
    if (p.user.id !== meId) list.push({ label: 'View profile', icon: 'person', onPress: () => router.push(`/user/${p.user.id}`) });
    if (!moderator || p.user.id === meId || p.role === 'host') return list;
    const go = (fn: () => Promise<void>) => () => run(fn);
    if (p.role === 'listener') list.push({ label: 'Invite to speak', icon: 'mic', onPress: go(() => actions.setRole(p.user.id, 'speaker')) });
    if (canSpeakIn(p.role) && !p.isMuted) list.push({ label: 'Mute', icon: 'mic-off', onPress: go(() => actions.muteParticipant(p.user.id)) });
    // Only listeners can co-host, since a co-host may end up hosting the room
    if (iAmHost && p.role !== 'cohost' && p.user.role === 'listener') {
      list.push({ label: 'Make co-host', icon: 'shield-checkmark', onPress: go(() => actions.setRole(p.user.id, 'cohost')) });
    }
    if (iAmHost && p.role === 'cohost') list.push({ label: 'Remove co-host', icon: 'shield-outline', onPress: go(() => actions.setRole(p.user.id, 'speaker')) });
    if (p.role === 'speaker' || (p.role === 'cohost' && iAmHost)) {
      list.push({ label: 'Move to audience', icon: 'headset', onPress: go(() => actions.setRole(p.user.id, 'listener')) });
    }
    if (p.role !== 'cohost' || iAmHost) {
      list.push({ label: 'Remove from room', icon: 'exit', destructive: true, onPress: go(() => actions.removeParticipant(p.user.id)) });
    }
    return list;
  };

  const onTilePress = (p: RoomParticipant) => {
    if (p.user.id !== meId) setSelected(p);
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await actions.sendMessage(text);
      setDraft('');
    } catch (e) {
      notify('Message not sent', getErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const menu: SheetAction[] = [
    ...(moderator ? [{ label: 'Edit room info', icon: 'create-outline' as const, onPress: () => setEditing(true) }] : []),
    { label: iAmHost ? 'End or leave room' : 'Leave room', icon: 'exit-outline', destructive: true, onPress: leave },
  ];

  return (
    <LinearGradient colors={theme.colors} style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <IconButton icon="chevron-down" onPress={goBack} size={40} background="transparent" accessibilityLabel="Minimise room" />
            <View style={styles.flex} />
            <View style={styles.countPill}>
              <Icon name="people" size={14} color={colors.text} />
              <Text variant="caption" style={styles.countText}>
                {room.participants.length}
              </Text>
            </View>
            <IconButton icon="ellipsis-vertical" onPress={() => setMenuOpen(true)} size={40} background="transparent" accessibilityLabel="Room options" />
          </View>

          <ScrollView style={[styles.top, { maxHeight: height * 0.58 }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.info}>
              <Text variant="title" style={styles.title} numberOfLines={3}>
                {room.title}
              </Text>
              <View style={styles.chips}>
                <View style={[styles.chip, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <Text variant="caption" style={[styles.chipText, { color: theme.accent }]}>
                    {theme.emoji} {room.topic}
                  </Text>
                </View>
                <View style={[styles.chip, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <Text variant="caption" style={styles.chipText}>
                    {room.language}
                  </Text>
                </View>
                <View style={[styles.chip, { backgroundColor: colors.dangerSoft }]}>
                  <View style={styles.liveDot} />
                  <Text variant="caption" style={[styles.chipText, { color: '#FCA5A5' }]}>
                    LIVE · {liveFor(room.createdAt).replace(/^live /, '')}
                  </Text>
                </View>
              </View>
            </View>

            {room.description ? (
              <Pressable onPress={moderator ? () => setEditing(true) : undefined} style={styles.welcome}>
                <Text style={styles.pin}>📌</Text>
                <Text variant="caption" style={styles.welcomeText}>
                  {room.description}
                </Text>
              </Pressable>
            ) : (
              moderator && (
                <Pressable onPress={() => setEditing(true)} style={[styles.welcome, styles.welcomeEmpty]}>
                  <Icon name="add" size={16} color={theme.accent} />
                  <Text variant="caption" style={{ color: theme.accent, fontWeight: '700' }}>
                    Add a welcome message or rules
                  </Text>
                </Pressable>
              )
            )}

            <View style={styles.stage}>
              {host && (
                <ParticipantTile
                  participant={host}
                  speaking={isSpeaking(host)}
                  isMe={host.user.id === meId}
                  size={96}
                  accent={theme.accent}
                  onPress={() => onTilePress(host)}
                />
              )}
              <View style={styles.speakers}>
                {others.map((p) => (
                  <ParticipantTile
                    key={p.user.id}
                    participant={p}
                    speaking={isSpeaking(p)}
                    isMe={p.user.id === meId}
                    size={68}
                    accent={theme.accent}
                    onPress={() => onTilePress(p)}
                  />
                ))}
              </View>
            </View>

            {moderator && raisedHands.length > 0 && (
              <View style={styles.hands}>
                <Text variant="label" color="muted">
                  ✋ Raised hands · {raisedHands.length}
                </Text>
                {raisedHands.map((p) => (
                  <View key={p.user.id} style={styles.handRow}>
                    <Avatar avatar={p.user.avatar} size={34} />
                    <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                      {p.user.name}
                    </Text>
                    <Button title="Invite" size="sm" onPress={() => run(() => actions.setRole(p.user.id, 'speaker'))} />
                    <IconButton
                      icon="close"
                      size={34}
                      onPress={() => run(() => actions.setRole(p.user.id, 'listener'))}
                      accessibilityLabel={`Lower ${p.user.name}'s hand`}
                    />
                  </View>
                ))}
              </View>
            )}

            {audience.length > 0 && (
              <View style={styles.audienceBlock}>
                <Text variant="label" color="muted">
                  🎧 Listening · {audience.length}
                </Text>
                <View style={styles.audience}>
                  {audience.slice(0, 24).map((p) => (
                    <ParticipantTile
                      key={p.user.id}
                      participant={p}
                      speaking={false}
                      isMe={p.user.id === meId}
                      size={46}
                      accent={theme.accent}
                      onPress={() => onTilePress(p)}
                    />
                  ))}
                  {audience.length > 24 && (
                    <View style={styles.more}>
                      <Text variant="bodyStrong">+{audience.length - 24}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.chat}>
            <RoomChat
              messages={messages}
              meId={meId}
              accent={theme.accent}
              onMessageAction={(m) => (m.user?.id === meId || moderator ? setMessageAction(m) : undefined)}
            />
            <FloatingReactions reactions={reactions} />
          </View>

          {!banner && me?.role === 'listener' && (
            <Text variant="caption" color="muted" center style={styles.hint}>
              {me.handRaised ? '✋ Hand raised. The host can invite you on stage.' : '🎧 You’re listening. Tap ✋ to ask to speak.'}
            </Text>
          )}

          {banner && (
            <View style={styles.banner}>
              <Icon name={voiceStatus === 'reconnecting' ? 'sync' : 'information-circle'} size={16} color={colors.warning} />
              <Text variant="caption" style={styles.bannerText}>
                {banner}
              </Text>
            </View>
          )}

          {picker && (
            <View style={styles.picker}>
              {ROOM_REACTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => actions.react(emoji)}
                  accessibilityLabel={`React ${emoji}`}
                  style={({ pressed }) => [styles.pickerItem, pressed && { transform: [{ scale: 1.25 }] }]}
                >
                  <Text style={styles.pickerEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.bottomBar}>
            <IconButton
              icon="exit-outline"
              size={44}
              color={colors.text}
              background="rgba(255,255,255,0.1)"
              onPress={leave}
              accessibilityLabel={iAmHost ? 'End or leave room' : 'Leave room'}
            />
            <View style={styles.inputWrap}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Say something…"
                placeholderTextColor={colors.textFaint}
                maxLength={200}
                onSubmitEditing={send}
                returnKeyType="send"
                style={styles.input}
              />
              {draft.trim().length > 0 && (
                <IconButton icon="send" size={34} color={colors.white} background={theme.accent} onPress={send} accessibilityLabel="Send message" />
              )}
            </View>
            <IconButton
              icon="happy-outline"
              size={44}
              color={picker ? colors.bg : colors.text}
              background={picker ? theme.accent : 'rgba(255,255,255,0.1)'}
              onPress={() => setPicker(!picker)}
              accessibilityLabel="Reactions"
            />
            {me?.role === 'listener' ? (
              <IconButton
                icon="hand-left"
                size={44}
                color={colors.white}
                background={me.handRaised ? colors.warning : 'rgba(255,255,255,0.1)'}
                onPress={() => run(() => actions.setHandRaised(!me.handRaised))}
                accessibilityLabel={me.handRaised ? 'Lower hand' : 'Raise hand to speak'}
              />
            ) : (
              me && (
                <IconButton
                  icon={me.isMuted ? 'mic-off' : 'mic'}
                  size={44}
                  color={colors.white}
                  background={me.isMuted ? 'rgba(255,255,255,0.1)' : theme.accent}
                  onPress={() => run(() => actions.setMuted(!me.isMuted))}
                  accessibilityLabel={me.isMuted ? 'Unmute' : 'Mute'}
                />
              )
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ActionSheet
        visible={selected !== null}
        title={selected?.user.name}
        actions={selected ? participantActions(selected) : []}
        onClose={() => setSelected(null)}
      />
      <ActionSheet
        visible={messageAction !== null}
        title={messageAction ? `“${messageAction.text.slice(0, 40)}${messageAction.text.length > 40 ? '…' : ''}”` : undefined}
        actions={
          messageAction
            ? [{ label: 'Delete message', icon: 'trash-outline', destructive: true, onPress: () => run(() => actions.deleteMessage(messageAction.id)) }]
            : []
        }
        onClose={() => setMessageAction(null)}
      />
      <ActionSheet visible={menuOpen} title={room.title} actions={menu} onClose={() => setMenuOpen(false)} />
      <FormSheet
        visible={editing}
        title="Room info"
        message="Everyone in the room sees this."
        submitLabel="Save"
        fields={[
          { key: 'title', label: 'Title', initialValue: room.title, minLength: 3, maxLength: 60 },
          {
            key: 'description',
            label: 'Welcome message / rules',
            initialValue: room.description,
            placeholder: 'e.g. Be kind. One person at a time. No personal numbers.',
            multiline: true,
            minLength: 0,
            maxLength: 200,
          },
        ]}
        onSubmit={async (values) => {
          await actions.updateRoom({ title: values.title.trim(), description: values.description.trim() });
          setEditing(false);
        }}
        onClose={() => setEditing(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, gap: spacing.xs },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  countText: { color: colors.text, fontWeight: '700' },
  top: { flexGrow: 0 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg },
  info: { gap: spacing.sm },
  title: { fontSize: 24, lineHeight: 30 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: 999 },
  chipText: { color: colors.text, fontWeight: '700', fontSize: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  hint: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  welcome: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  welcomeEmpty: { justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed' },
  pin: { fontSize: 14 },
  welcomeText: { flex: 1, color: colors.text, lineHeight: 18 },
  stage: { alignItems: 'center', gap: spacing.lg, paddingTop: spacing.sm },
  speakers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md },
  hands: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  handRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  audienceBlock: { gap: spacing.sm },
  audience: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  more: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  // Fills whatever space the stage leaves, so there's no empty gap
  chat: { flex: 1, minHeight: 150, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  bannerText: { flex: 1, color: colors.warning },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  pickerItem: { padding: spacing.xs },
  pickerEmoji: { fontSize: 26 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingLeft: spacing.md,
    paddingRight: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  input: { flex: 1, height: '100%', color: colors.text, fontSize: 14 },
});
