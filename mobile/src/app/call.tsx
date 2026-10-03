import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PulseRings } from '@/components/calls/PulseRings';
import { Avatar, Button, Card, Icon, StarRating, Text } from '@/components/ui';
import { ListenerBadge } from '@/components/users/ListenerBadge';
import { CALL_RATE_PER_MIN } from '@/constants/config';
import { useElapsedSeconds } from '@/hooks/useElapsedSeconds';
import { isCallActive, useCallStore } from '@/store/callStore';
import { useVoiceStore } from '@/store/voiceStore';
import { useWalletStore } from '@/store/walletStore';
import { colors, gradients, spacing } from '@/theme';
import type { CallDirection, CallEndReason } from '@/types';
import { formatDuration, formatRupees, formatShortDuration } from '@/utils/format';

function endTitle(reason: CallEndReason | null, direction: CallDirection | null, name: string): string {
  const outgoing = direction === 'outgoing';
  switch (reason) {
    case 'peer_hangup':
      return `${name} ended the call`;
    case 'rejected':
      return outgoing ? `${name} declined your call` : 'Call declined';
    case 'no_answer':
      return outgoing ? `${name} didn’t answer` : 'Missed call';
    case 'busy':
      return `${name} is on another call`;
    case 'cancelled':
      return 'Call cancelled';
    case 'insufficient_balance':
      return 'Call ended: out of coins';
    default:
      return 'Call ended';
  }
}

function ControlButton({
  label,
  onPress,
  background,
  size = 64,
  children,
}: {
  label: string;
  onPress: () => void;
  background: string;
  size?: number;
  children: ReactNode;
}) {
  return (
    <View style={styles.control}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.controlCircle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: background, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        {children}
      </Pressable>
      <Text variant="caption" color="muted">
        {label}
      </Text>
    </View>
  );
}

export default function CallScreen() {
  const call = useCallStore();
  const balance = useWalletStore((s) => s.balance);
  const voice = useVoiceStore();
  const elapsed = useElapsedSeconds(call.phase === 'connected' ? call.connectedAt : null);
  const [stars, setStars] = useState(0);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  // Opened with no call (e.g. after a reload): nothing to show
  useEffect(() => {
    if (useCallStore.getState().phase === 'idle') close();
  }, [close]);

  // Clear the finished call once the screen goes away
  useEffect(
    () => () => {
      if (useCallStore.getState().phase === 'ended') useCallStore.getState().reset();
    },
    [],
  );

  // Android back button must not leave an active call
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => isCallActive(useCallStore.getState().phase));
    return () => sub.remove();
  }, []);

  // Calls that never connected (declined, missed, cancelled) close by themselves
  useEffect(() => {
    if (call.phase !== 'ended' || call.error || call.connectedAt !== null) return;
    if (call.direction === 'incoming' || call.endReason === 'cancelled') {
      const id = setTimeout(close, 1500);
      return () => clearTimeout(id);
    }
  }, [call.phase, call.error, call.connectedAt, call.direction, call.endReason, close]);

  const { peer, phase } = call;
  if (!peer) return <View style={styles.root} />;

  const connectedEver = call.connectedAt !== null;
  const outgoing = call.direction === 'outgoing';
  const lowBalance = phase === 'connected' && outgoing && balance < CALL_RATE_PER_MIN;

  // How the audio is doing, shown under the timer while connected
  const audioNote =
    phase !== 'connected'
      ? null
      : voice.status === 'reconnecting'
        ? 'Reconnecting audio…'
        : voice.message
          ? voice.message
          : voice.status === 'connecting'
            ? 'Connecting audio…'
            : voice.status === 'connected' && voice.remoteUids.length === 0
              ? `Waiting for ${peer?.name ?? 'them'} to connect…`
              : null;

  const status =
    phase === 'outgoing'
      ? call.callId
        ? 'Ringing…'
        : 'Calling…'
      : phase === 'incoming'
        ? 'Incoming voice call'
        : phase === 'connected'
          ? formatDuration(elapsed)
          : call.error
            ? 'Couldn’t connect'
            : endTitle(call.endReason, call.direction, peer.name);

  return (
    <LinearGradient colors={gradients.call} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Icon name="lock-closed" size={12} color={colors.textMuted} />
          <Text variant="caption" color="muted">
            Private voice call
          </Text>
        </View>

        <View style={styles.center}>
          <View style={styles.avatarWrap}>
            <PulseRings
              size={140}
              active={phase === 'outgoing' || phase === 'incoming'}
              color={phase === 'incoming' ? colors.success : colors.primary}
            />
            <Avatar avatar={peer.avatar} size={140} />
          </View>
          <Text variant="title" center>
            {peer.name}
          </Text>
          {peer.role === 'listener' && <ListenerBadge />}
          <Text variant="body" color="muted" center style={phase === 'connected' ? styles.timer : null}>
            {status}
          </Text>
          {audioNote && (
            <View style={styles.audioNote}>
              <Icon name={voice.status === 'connected' && !voice.message ? 'time-outline' : 'volume-mute'} size={14} color={colors.warning} />
              <Text variant="caption" style={styles.audioNoteText}>
                {audioNote}
              </Text>
            </View>
          )}
          {phase === 'connected' && outgoing && (
            <Text variant="caption" color="faint">
              {CALL_RATE_PER_MIN} coins/min · Balance {balance}
            </Text>
          )}

          {lowBalance && (
            <View style={styles.warning}>
              <Icon name="warning" size={18} color={colors.warning} />
              <Text variant="caption" style={styles.warningText}>
                Low balance. The call will end when this minute is over.
              </Text>
              <Button title="Recharge" size="sm" variant="secondary" onPress={() => router.push('/recharge')} />
            </View>
          )}
        </View>

        <View style={styles.bottom}>
          {phase === 'ended' ? (
            <>
              <Card style={styles.summary}>
                {call.error ? (
                  <Text variant="body" color="muted" center>
                    {call.error}
                  </Text>
                ) : connectedEver ? (
                  <>
                    <View style={styles.summaryRow}>
                      <View style={styles.summaryItem}>
                        <Text variant="heading">{formatShortDuration(call.durationSec)}</Text>
                        <Text variant="caption" color="muted">
                          Duration
                        </Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text variant="heading" color={outgoing ? 'default' : 'success'}>
                          {outgoing ? call.coins : formatRupees(call.earnedPaise, true)}
                        </Text>
                        <Text variant="caption" color="muted">
                          {outgoing ? 'Coins spent' : 'You earned'}
                        </Text>
                      </View>
                    </View>
                    <Text variant="bodyStrong" center>
                      {call.rated ? 'Thanks for your feedback!' : `How was your talk with ${peer.name}?`}
                    </Text>
                    <StarRating
                      value={stars}
                      onChange={
                        call.rated
                          ? undefined
                          : (value) => {
                              setStars(value);
                              call.rate(value);
                            }
                      }
                    />
                  </>
                ) : (
                  <Text variant="body" color="muted" center>
                    {outgoing ? 'You weren’t charged for this call.' : 'You can call them back from your call history.'}
                  </Text>
                )}
              </Card>
              {call.error && balance < CALL_RATE_PER_MIN ? (
                <Button title="Recharge" icon="add" onPress={() => router.replace('/recharge')} />
              ) : (
                outgoing && (
                  <Button
                    title="Call again"
                    icon="call"
                    variant="secondary"
                    onPress={() => {
                      setStars(0);
                      call.startCall(peer);
                    }}
                  />
                )
              )}
              <Button title="Done" onPress={close} />
            </>
          ) : phase === 'incoming' ? (
            <View style={styles.controls}>
              <ControlButton label="Decline" onPress={call.decline} background={colors.danger} size={72}>
                <MaterialIcons name="call-end" size={32} color={colors.white} />
              </ControlButton>
              <ControlButton label="Accept" onPress={call.accept} background={colors.success} size={72}>
                <MaterialIcons name="call" size={32} color={colors.white} />
              </ControlButton>
            </View>
          ) : (
            <View style={styles.controls}>
              <ControlButton
                label={call.muted ? 'Unmute' : 'Mute'}
                onPress={call.toggleMute}
                background={call.muted ? colors.white : colors.surfaceAlt}
              >
                <Icon name={call.muted ? 'mic-off' : 'mic'} size={26} color={call.muted ? colors.bg : colors.white} />
              </ControlButton>
              <ControlButton label="End" onPress={call.hangup} background={colors.danger} size={72}>
                <MaterialIcons name="call-end" size={32} color={colors.white} />
              </ControlButton>
              {/* Browsers pick the output device themselves */}
              {Platform.OS !== 'web' && (
                <ControlButton
                  label="Speaker"
                  onPress={call.toggleSpeaker}
                  background={call.speaker ? colors.white : colors.surfaceAlt}
                >
                  <Icon name="volume-high" size={26} color={call.speaker ? colors.bg : colors.white} />
                </ControlButton>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
  avatarWrap: { width: 260, height: 260, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  timer: { fontVariant: ['tabular-nums'], fontSize: 20, color: colors.text },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.warningSoft,
  },
  warningText: { flex: 1, color: colors.warning },
  audioNote: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 320 },
  audioNoteText: { color: colors.warning, textAlign: 'center' },
  bottom: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  controls: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-start' },
  control: { alignItems: 'center', gap: spacing.sm },
  controlCircle: { alignItems: 'center', justifyContent: 'center' },
  summary: { gap: spacing.lg },
  summaryRow: { flexDirection: 'row' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
});
