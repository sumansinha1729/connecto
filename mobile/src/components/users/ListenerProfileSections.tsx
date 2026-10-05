import { StyleSheet, View } from 'react-native';

import { VoicePlayer } from '@/components/listener/VoicePlayer';
import { Card, Icon, Text } from '@/components/ui';
import { INTEREST_EMOJI } from '@/constants/options';
import { colors, radius, spacing } from '@/theme';
import type { ListenerProfile, User } from '@/types';

/** "Hear Nisha": the listener's approved voice intro */
export function VoiceIntroCard({ user, profile }: { user: User; profile: ListenerProfile }) {
  if (!profile.voiceIntroUrl) return null;
  return (
    <Card style={styles.voiceCard}>
      <View style={styles.voiceHead}>
        <View style={styles.voiceIcon}>
          <Icon name="mic" size={18} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">Hear {user.name}</Text>
          <Text variant="caption" color="muted">
            A short hello, so you know who you’ll be talking to
          </Text>
        </View>
      </View>
      <VoicePlayer key={profile.voiceIntroUrl} uri={profile.voiceIntroUrl} fallbackDurationSec={profile.voiceIntroDurationSec} />
    </Card>
  );
}

function Stat({ value, label, icon }: { value: string; label: string; icon?: React.ReactNode }) {
  return (
    <Card style={styles.stat}>
      <View style={styles.statValue}>
        {icon}
        <Text variant="heading">{value}</Text>
      </View>
      <Text variant="caption" color="muted" center>
        {label}
      </Text>
    </Card>
  );
}

/** Rating · minutes talked · how often they pick up (or calls taken) */
export function ListenerStats({ user, profile }: { user: User; profile: ListenerProfile }) {
  return (
    <View style={styles.stats}>
      <Stat
        value={user.ratingCount ? user.rating.toFixed(1) : 'New'}
        label={user.ratingCount ? `${user.ratingCount.toLocaleString('en-IN')} ratings` : 'no ratings yet'}
        icon={user.ratingCount ? <Icon name="star" size={16} color={colors.coin} /> : undefined}
      />
      <Stat value={profile.minutesTalked.toLocaleString('en-IN')} label="minutes talked" />
      {profile.answerRate !== null ? (
        <Stat value={`${profile.answerRate}%`} label="calls picked up" />
      ) : (
        <Stat value={user.totalCalls.toLocaleString('en-IN')} label="calls taken" />
      )}
    </View>
  );
}

/** "Can help with" chips, from the listener's interests */
export function HelpsWith({ topics }: { topics: string[] }) {
  if (!topics.length) return null;
  return (
    <View style={styles.section}>
      <Text variant="label" color="muted">
        Can help with
      </Text>
      <View style={styles.chips}>
        {topics.map((t) => (
          <View key={t} style={styles.topic}>
            <Text variant="caption" style={styles.topicText}>
              {INTEREST_EMOJI[t] ?? '💬'} {t}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** 5★ … 1★ bars from real calls; hidden until someone has rated a call */
export function RatingBreakdown({ profile }: { profile: ListenerProfile }) {
  const total = profile.ratingBreakdown.reduce((n, r) => n + r.count, 0);
  if (!total) return null;
  return (
    <View style={styles.section}>
      <Text variant="label" color="muted">
        What callers say
      </Text>
      <Card style={styles.breakdown}>
        {profile.ratingBreakdown.map((r) => (
          <View key={r.stars} style={styles.barRow}>
            <Text variant="caption" style={styles.barLabel}>
              {r.stars}★
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round((r.count / total) * 100)}%` }]} />
            </View>
            <Text variant="caption" color="muted" style={styles.barCount}>
              {r.count}
            </Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  voiceCard: { gap: spacing.md, borderColor: colors.primary, borderWidth: 1, backgroundColor: colors.primarySoft },
  voiceHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  voiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: spacing.sm },
  statValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  section: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  topic: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topicText: { color: colors.text, fontWeight: '600' },
  breakdown: { gap: spacing.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 26, color: colors.text, fontWeight: '700' },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.coin },
  barCount: { width: 32, textAlign: 'right' },
});
