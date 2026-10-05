import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionSheet, Avatar, Button, Chip, EmptyState, Header, Icon, IconButton, LoadingView, Screen, Text } from '@/components/ui';
import { ListenerBadge } from '@/components/users/ListenerBadge';
import { HelpsWith, ListenerStats, RatingBreakdown, VoiceIntroCard } from '@/components/users/ListenerProfileSections';
import { availability, isCallable } from '@/components/users/UserCard';
import { CALL_RATE_PER_MIN } from '@/constants/config';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useStartCall } from '@/hooks/useStartCall';
import { api } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing } from '@/theme';
import { confirm, notify } from '@/utils/dialog';
import { getErrorMessage } from '@/utils/errors';
import { formatAgeGender } from '@/utils/format';
import { goBack } from '@/utils/navigation';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const startCall = useStartCall();
  const canCall = useAuthStore((s) => s.user?.role === 'user' && s.user.signupIntent === 'user');
  const meId = useAuthStore((s) => s.user?.id);
  const [menuOpen, setMenuOpen] = useState(false);

  const { data, setData, loading, error, refresh } = useAsyncData(async () => {
    const { user, isFavorite, listenerProfile } = await api.users.getProfile(id);
    return { user, favorite: isFavorite, listenerProfile };
  }, [id]);

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

  const { user, favorite, listenerProfile } = data;
  const isMe = user.id === meId;
  const callable = isCallable(user);
  // Only normal users call, and only listeners can be called
  const showCall = canCall && user.role === 'listener' && !isMe;
  const isListener = user.role === 'listener';

  return (
    <Screen
      scroll
      padded={false}
      footer={
        isMe ? undefined : (
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
                title={
                  callable
                    ? `Call · ${CALL_RATE_PER_MIN} coins/min`
                    : user.isBusy
                      ? 'On a call · try again soon'
                      : 'Not available right now'
                }
                icon="call"
                onPress={() => startCall(user)}
                disabled={!callable}
                style={styles.callButton}
              />
            )}
          </View>
        )
      }
    >
      <Header
        title={isMe ? 'Your public profile' : undefined}
        right={
          isMe ? undefined : (
            <IconButton
              icon="ellipsis-vertical"
              onPress={() => setMenuOpen(true)}
              size={40}
              background="transparent"
              accessibilityLabel="More options"
            />
          )
        }
      />

      <View style={styles.hero}>
        <Avatar avatar={user.avatar} size={120} online={user.isOnline} />
        <View style={styles.nameRow}>
          <Text variant="title">{user.name}</Text>
          {isListener && <ListenerBadge />}
        </View>
        <Text variant="body" color="muted">
          {[formatAgeGender(user.age, user.gender), user.languages.join(', ')].filter(Boolean).join(' · ')}
        </Text>
        <Text variant="caption" style={{ color: availability(user).color }}>
          {user.isOnline && !user.isBusy && (!isListener || user.isAvailable) ? 'Online now' : availability(user).label}
        </Text>
      </View>

      <View style={styles.body}>
        {isMe && (
          <View style={styles.notice}>
            <Icon name="eye-outline" size={16} color={colors.primary} />
            <Text variant="caption" style={styles.noticeText}>
              This is how callers see your profile. Change your bio and topics in Edit profile.
            </Text>
          </View>
        )}

        {listenerProfile ? (
          <>
            <VoiceIntroCard user={user} profile={listenerProfile} />
            <ListenerStats user={user} profile={listenerProfile} />
            {listenerProfile.callsWithYou > 0 && !isMe && (
              <View style={styles.talked}>
                <Icon name="call" size={14} color={colors.success} />
                <Text variant="caption" style={styles.talkedText}>
                  You’ve talked {listenerProfile.callsWithYou === 1 ? 'once' : `${listenerProfile.callsWithYou} times`}
                </Text>
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
            <HelpsWith topics={user.interests} />
            <RatingBreakdown profile={listenerProfile} />
            <Text variant="caption" color="faint" center>
              Listener since {new Date(listenerProfile.listenerSince).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </Text>
          </>
        ) : (
          <>
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
          </>
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
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  noticeText: { flex: 1, color: colors.text },
  talked: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.successSoft,
  },
  talkedText: { color: colors.success, fontWeight: '700' },
  section: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  callButton: { flex: 1 },
});
