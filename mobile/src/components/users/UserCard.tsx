import { StyleSheet, View } from 'react-native';

import { Avatar, Card, Icon, IconButton, Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { User } from '@/types';
import { formatAgeGender } from '@/utils/format';
import { ListenerBadge } from './ListenerBadge';

export function isCallable(user: User): boolean {
  return user.isOnline && (user.role !== 'listener' || user.isAvailable);
}

interface UserCardProps {
  user: User;
  onPress: () => void;
  onCall: () => void;
}

export function UserCard({ user, onPress, onCall }: UserCardProps) {
  const callable = isCallable(user);
  const meta = [formatAgeGender(user.age, user.gender), user.languages.slice(0, 2).join(', ')].filter(Boolean).join(' · ');

  return (
    <Card onPress={onPress} style={styles.card}>
      <Avatar avatar={user.avatar} size={56} online={user.isOnline} />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
            {user.name}
          </Text>
          {user.role === 'listener' && <ListenerBadge />}
        </View>
        <Text variant="caption" color="muted" numberOfLines={1}>
          {meta}
        </Text>
        {user.role === 'listener' ? (
          <View style={styles.statsRow}>
            <Icon name="star" size={12} color={colors.coin} />
            <Text variant="caption" color="muted">
              {user.rating.toFixed(1)} · {user.totalCalls.toLocaleString('en-IN')} calls
            </Text>
          </View>
        ) : (
          <Text variant="caption" color="faint" numberOfLines={1}>
            {user.bio}
          </Text>
        )}
      </View>
      <IconButton
        icon="call"
        onPress={onCall}
        disabled={!callable}
        color={colors.white}
        background={callable ? colors.success : colors.surfaceAlt}
        accessibilityLabel={`Call ${user.name}`}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
