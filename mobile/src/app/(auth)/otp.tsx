import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Header, Screen, Text } from '@/components/ui';
import { OTP_LENGTH, OTP_RESEND_SEC } from '@/constants/config';
import { api } from '@/services';
import { firebaseLoginEnabled, phoneAuth, phoneAuthErrorMessage } from '@/services/phoneAuth';
import { useAuthStore } from '@/store/authStore';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function OtpScreen() {
  const { phone = '', devOtp } = useLocalSearchParams<{ phone: string; devOtp?: string }>();
  const signIn = useAuthStore((s) => s.signIn);
  const inputRef = useRef<TextInput>(null);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(OTP_RESEND_SEC);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const finishing = useRef(false);

  /** Firebase proved the number: exchange its ID token for our session */
  const finishWithFirebase = useCallback(
    async (idToken: string) => {
      if (finishing.current) return;
      finishing.current = true;
      setLoading(true);
      setError(null);
      try {
        const { tokens, user } = await api.auth.loginWithFirebase(idToken);
        phoneAuth.reset();
        signIn(tokens, user);
        router.replace('/');
      } catch (e) {
        finishing.current = false;
        setError(phoneAuthErrorMessage(e));
        setCode('');
        setLoading(false);
      }
    },
    [signIn],
  );

  // Android can read the SMS by itself and verify the number without the code being typed
  useEffect(() => (firebaseLoginEnabled ? phoneAuth.onAutoVerified(finishWithFirebase) : undefined), [finishWithFirebase]);

  const verify = async (value: string) => {
    if (finishing.current) return;
    setLoading(true);
    setError(null);
    try {
      if (firebaseLoginEnabled) {
        await finishWithFirebase(await phoneAuth.confirmCode(value));
        return;
      }
      const { tokens, user } = await api.auth.verifyOtp(phone, value);
      signIn(tokens, user);
      router.replace('/');
    } catch (e) {
      setError(phoneAuthErrorMessage(e));
      setCode('');
      setLoading(false);
    }
  };

  const onChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    if (digits.length === OTP_LENGTH) verify(digits);
  };

  const resend = async () => {
    setError(null);
    try {
      if (firebaseLoginEnabled) await phoneAuth.sendCode(phone);
      else await api.auth.requestOtp(phone);
      setResendIn(OTP_RESEND_SEC);
    } catch (e) {
      setError(phoneAuthErrorMessage(e));
    }
  };

  return (
    <Screen
      keyboard
      padded={false}
      footer={
        <Button
          title="Verify"
          onPress={() => verify(code)}
          loading={loading}
          disabled={code.length !== OTP_LENGTH}
          style={styles.button}
        />
      }
    >
      <Header />
      <View style={styles.content}>
        <Text variant="title">Enter the code</Text>
        <Text variant="body" color="muted">
          We sent a {OTP_LENGTH}-digit code to +91 {phone}
        </Text>

        <Pressable style={styles.boxes} onPress={() => inputRef.current?.focus()}>
          {Array.from({ length: OTP_LENGTH }, (_, i) => (
            <View
              key={i}
              style={[
                styles.box,
                i === code.length && styles.boxActive,
                Boolean(error) && styles.boxError,
              ]}
            >
              <Text style={styles.digit}>{code[i] ?? ''}</Text>
            </View>
          ))}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={onChange}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={OTP_LENGTH}
            autoFocus
            caretHidden
            style={styles.hiddenInput}
          />
        </Pressable>

        {error && (
          <Text variant="caption" color="danger">
            {error}
          </Text>
        )}

        <View style={styles.resendRow}>
          {resendIn > 0 ? (
            <Text variant="caption" color="muted">
              Resend code in {resendIn}s
            </Text>
          ) : (
            <Button title="Resend code" variant="ghost" size="sm" onPress={resend} />
          )}
        </View>

        {devOtp && (
          <View style={styles.devHint}>
            <Text variant="caption" color="muted">
              Test mode: use code <Text variant="caption" color="primary" style={styles.bold}>{devOtp}</Text>
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.sm },
  box: {
    width: 48,
    height: 58,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.primary },
  boxError: { borderColor: colors.danger },
  digit: { fontSize: fontSize.xl, fontWeight: '700' },
  hiddenInput: { position: 'absolute', width: '100%', height: '100%', opacity: 0 },
  resendRow: { alignItems: 'flex-start', minHeight: 38, justifyContent: 'center' },
  devHint: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  bold: { fontWeight: '700' },
  button: { marginHorizontal: spacing.lg },
});
