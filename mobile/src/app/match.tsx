import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PulseRings } from '@/components/calls/PulseRings';
import { ChipSelect } from '@/components/profile/ChipSelect';
import { Avatar, Button, Header, Icon, Text } from '@/components/ui';
import { CALL_RATE_PER_MIN } from '@/constants/config';
import { api } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { useCallStore } from '@/store/callStore';
import { useWalletStore } from '@/store/walletStore';
import { colors, gradients, spacing } from '@/theme';
import type { User } from '@/types';
import { getErrorMessage } from '@/utils/errors';

type MatchState = { status: 'searching' } | { status: 'found'; user: User } | { status: 'error'; message: string };

const ANY = 'Any language';

export default function MatchScreen() {
  const myLanguages = useAuthStore((s) => s.user?.languages ?? []);
  const balance = useWalletStore((s) => s.balance);
  const [language, setLanguage] = useState(myLanguages[0] ?? ANY);
  const [state, setState] = useState<MatchState>({ status: 'searching' });
  const attempt = useRef(0);
  const lowBalance = balance < CALL_RATE_PER_MIN;

  const search = useCallback(async () => {
    const current = ++attempt.current;
    setState({ status: 'searching' });
    try {
      const user = await api.calls.findMatch(language === ANY ? null : language);
      if (current !== attempt.current) return;
      setState({ status: 'found', user });
    } catch (e) {
      if (current === attempt.current) setState({ status: 'error', message: getErrorMessage(e) });
    }
  }, [language]);

  useEffect(() => {
    if (!lowBalance) search();
    return () => {
      // Invalidate any in-flight search when leaving or restarting
      attempt.current++;
    };
  }, [search, lowBalance]);

  // Once matched, connect automatically after a short pause
  useEffect(() => {
    if (state.status !== 'found') return;
    const id = setTimeout(() => {
      useCallStore.getState().startCall(state.user);
      router.replace('/call');
    }, 1500);
    return () => clearTimeout(id);
  }, [state]);

  const avatar = state.status === 'found' ? state.user.avatar : null;

  return (
    <LinearGradient colors={gradients.call} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <Header back="close" />

        <View style={styles.center}>
          <View style={styles.circle}>
            <PulseRings size={140} active={state.status === 'searching' && !lowBalance} />
            {avatar ? (
              <Avatar avatar={avatar} size={140} />
            ) : (
              <View style={styles.searchIcon}>
                <Icon name={lowBalance ? 'wallet' : 'headset'} size={56} color={colors.white} />
              </View>
            )}
          </View>

          {lowBalance ? (
            <>
              <Text variant="title" center>
                Not enough coins
              </Text>
              <Text variant="body" color="muted" center>
                Calls cost {CALL_RATE_PER_MIN} coins per minute. Recharge to talk to a listener.
              </Text>
            </>
          ) : state.status === 'searching' ? (
            <>
              <Text variant="title" center>
                Finding a listener…
              </Text>
              <Text variant="body" color="muted" center>
                Hang tight, we’re looking for someone free to talk.
              </Text>
            </>
          ) : state.status === 'found' ? (
            <>
              <Text variant="title" center>
                {state.user.name} is free!
              </Text>
              <Text variant="body" color="muted" center>
                Connecting you now…
              </Text>
            </>
          ) : (
            <>
              <Text variant="title" center>
                No match yet
              </Text>
              <Text variant="body" color="muted" center>
                {state.message}
              </Text>
            </>
          )}
        </View>

        <View style={styles.bottom}>
          {lowBalance ? (
            <Button title="Recharge" icon="add" onPress={() => router.replace('/recharge')} />
          ) : (
            <>
              {state.status !== 'found' && (
                <ChipSelect
                  label="Preferred language"
                  options={[ANY, ...myLanguages]}
                  selected={[language]}
                  onChange={([value]) => setLanguage(value)}
                  multiple={false}
                />
              )}
              {state.status === 'error' && <Button title="Try again" icon="refresh" onPress={search} />}
            </>
          )}
          <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  circle: { width: 260, height: 260, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  searchIcon: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  bottom: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
