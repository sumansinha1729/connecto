import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionSheet, Avatar, Button, Card, Chip, EmptyState, Header, IconButton, LoadingView, Screen, Text } from '@/components/ui';
import { ListenerBadge } from '@/components/users/ListenerBadge';
import { isCallable } from '@/components/users/UserCard';
import { CALL_RATE_PER_MIN } from '@/constants/config';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useStartCall } from '@/hooks/useStartCall';
import { api } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';
import { confirm, notify } from '@/utils/dialog';
import { getErrorMessage } from '@/utils/errors';
import { formatAgeGender } from '@/utils/format';
import { goBack } from '@/utils/navigation';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const startCall = useStartCall();
  const canCall = useAuthStore((s) => s.user?.role === 'user' && s.user.signupIntent === 'user');
  const [menuOpen, setMenuOpen] = useState(false);

  const { data, setData, loading, error, refresh } = useAsyncData(
    async () => {
      const { user, isFavorite } = await api.users.getProfile(id);
      return { user, favorite: isFavorite };
    },
    [id],
  );

  const toggleFavorite = async () => {
    if (!data) return;
    const favorite = !data.favorite;
    setData({ ...data, favorite });
    try {
      await api.users.setFavorite(id, favorite);
    } catch (e) {
      setData({ ...data, favorite: !favorite });
      notify('Couldn’t update favourites', getErrorMessage(e));
    }
  };

  const block = async () => {
    if (!data) return;
    const ok = await confirm({
      title: `Block ${data.user.name}?`,
      message: 'They won’t be able to call you or see you, and you won’t see them.',
      confirmText: 'Block',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.users.setBlocked(id, true);
      goBack();
    } catch (e) {
      notify('Couldn’t block user', getErrorMessage(e));
    }
  };

  if (loading) {
    return (
      <Screen padded={false}>
        <Header />
        <LoadingView />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen padded={false}>
        <Header />
        <EmptyState icon="person" title="Profile unavailable" message={error ?? undefined} actionLabel="Retry" onAction={refresh} />
      </Screen>
    );
  }

  const { user, favorite } = data;
  const callable = isCallable(user);
  // Only normal users call, and only listeners can be called
  const showCall = canCall && user.role === 'listener';
  const isListener = user.role === 'listener';

  return (
    <Screen
      scroll
      padded={false}
      footer={
        <View style={styles.footer}>
          <IconButton
            icon={favorite ? 'heart' : 'heart-outline'}
            onPress={toggleFavorite}
            size={52}
            color={favorite ? colors.accent : colors.text}
            accessibilityLabel={favorite ? 'Remove from favourites' : 'Add to favourites'}
          />
          {showCall && (
            <Button
              title={callable ? `Call · ${CALL_RATE_PER_MIN} coins/min` : 'Not available right now'}
              icon="call"
              onPress={() => startCall(user)}
              disabled={!callable}
              style={styles.callButton}
            />
          )}
        </View>
      }
    >
      <Header
        right={<IconButton icon="ellipsis-vertical" onPress={() => setMenuOpen(true)} size={40} background="transparent" accessibilityLabel="More options" />}
      />

      <View style={styles.hero}>
        <Avatar avatar={user.avatar} size={120} online={user.isOnline} />
        <View style={styles.nameRow}>
          <Text variant="title">{user.name}</Text>
          {isListener && <ListenerBadge />}
        </View>
        <Text variant="body" color="muted">
          {formatAgeGender(user.age, user.gender)}
        </Text>
        <Text variant="caption" style={{ color: user.isOnline ? colors.success : colors.textFaint }}>
          {user.isOnline ? (isListener && !user.isAvailable ? 'Online · busy' : 'Online now') : 'Offline'}
        </Text>
      </View>

      <View style={styles.body}>
        {isListener && (
          <View style={styles.stats}>
            <Card style={styles.stat}>
              <Text variant="heading">★ {user.rating.toFixed(1)}</Text>
              <Text variant="caption" color="muted">
                {user.ratingCount.toLocaleString('en-IN')} ratings
              </Text>
            </Card>
            <Card style={styles.stat}>
              <Text variant="heading">{user.totalCalls.toLocaleString('en-IN')}</Text>
              <Text variant="caption" color="muted">
                calls taken
              </Text>
            </Card>
          </View>
        )}

        {Boolean(user.bio) && (
          <View style={styles.section}>
            <Text variant="label" color="muted">
              About
            </Text>
            <Text variant="body">{user.bio}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text variant="label" color="muted">
            Speaks
          </Text>
          <View style={styles.chips}>
            {user.languages.map((l) => (
              <Chip key={l} label={l} icon="language" />
            ))}
          </View>
        </View>

        {user.interests.length > 0 && (
          <View style={styles.section}>
            <Text variant="label" color="muted">
              Likes to talk about
            </Text>
            <View style={styles.chips}>
              {user.interests.map((i) => (
                <Chip key={i} label={i} />
              ))}
            </View>
          </View>
        )}
      </View>

      <ActionSheet
        visible={menuOpen}
        title={user.name}
        onClose={() => setMenuOpen(false)}
        actions={[
          { label: 'Report', icon: 'flag-outline', onPress: () => router.push(`/report/${user.id}`) },
          { label: 'Block', icon: 'ban', destructive: true, onPress: block },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.xl },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  body: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  section: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  callButton: { flex: 1 },
});
