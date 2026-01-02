import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Icon, Screen, Text, TextField, type IconName } from '@/components/ui';
import { api } from '@/services';
import { colors, gradients, spacing } from '@/theme';
import { getErrorMessage } from '@/utils/errors';

const HIGHLIGHTS: { icon: IconName; text: string }[] = [
  { icon: 'happy', text: 'Stay anonymous with a generated avatar' },
  { icon: 'mic', text: 'Join live voice rooms on topics you care about' },
  { icon: 'ribbon', text: 'Talk 1:1 with caring, rated listeners' },
];

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const { devOtp } = await api.auth.requestOtp(phone);
      // The server only returns devOtp outside production
      router.push({ pathname: '/otp', params: { phone, ...(devOtp && { devOtp }) } });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      scroll
      keyboard
      footer={
        <View style={styles.footer}>
          <Button title="Get OTP" onPress={submit} loading={loading} disabled={phone.length !== 10} />
          <Text variant="caption" color="faint" center>
            By continuing you confirm you are 18+ and agree to our Terms and Privacy Policy.
          </Text>
        </View>
      }
    >
      <View style={styles.hero}>
        <LinearGradient colors={gradients.primary} style={styles.logo}>
          <Icon name="chatbubbles" size={40} color={colors.white} />
        </LinearGradient>
        <Text variant="hero">Connecto</Text>
        <Text variant="body" color="muted" center>
          Talk openly. Feel heard. Make real friends.
        </Text>
      </View>

      <View style={styles.highlights}>
        {HIGHLIGHTS.map((h) => (
          <View key={h.text} style={styles.highlight}>
            <Icon name={h.icon} size={18} color={colors.primary} />
            <Text variant="caption" color="muted" style={styles.highlightText}>
              {h.text}
            </Text>
          </View>
        ))}
      </View>

      <TextField
        label="Mobile number"
        prefix="+91"
        placeholder="98765 43210"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={(text) => setPhone(text.replace(/\D/g, '').slice(0, 10))}
        maxLength={10}
        error={error}
        onSubmitEditing={() => phone.length === 10 && submit()}
        autoFocus
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl * 1.5, paddingBottom: spacing.xl },
  logo: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  highlights: { gap: spacing.md, marginBottom: spacing.xxl },
  highlight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  highlightText: { flex: 1 },
  footer: { gap: spacing.md },
});
