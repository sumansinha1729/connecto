import { StyleSheet, View } from 'react-native';

import { Avatar, Card, Text } from '@/components/ui';
import { spacing } from '@/theme';
import type { Me } from '@/types';
import { formatRelativeTime } from '@/utils/format';
import { VoicePlayer } from './VoicePlayer';

/** What the applicant sent: shown while it's under review */
export function ApplicationSummary({ user }: { user: Me }) {
  const app = user.listenerApplication;
  return (
    <Card style={styles.card}>
      <View style={styles.profileRow}>
        <Avatar avatar={user.avatar} size={48} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{user.name}</Text>
          <Text variant="caption" color="muted">
            {[app.fullName, app.city].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
      {app.about && <Text variant="body">“{app.about}”</Text>}
      {app.voiceIntroUrl && <VoicePlayer key={app.voiceIntroUrl} uri={app.voiceIntroUrl} fallbackDurationSec={app.voiceIntroDurationSec} />}
      {app.appliedAt && (
        <Text variant="caption" color="faint">
          Sent {formatRelativeTime(app.appliedAt)}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
