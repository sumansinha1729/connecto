import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, type KeyboardTypeOptions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';
import { TextField } from './TextField';

export interface FormField {
  key: string;
  label: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  /** Minimum trimmed length before the form can be submitted (default 1) */
  minLength?: number;
  maxLength?: number;
  /** Pre-filled value, e.g. when editing */
  initialValue?: string;
}

interface FormSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  fields: FormField[];
  submitLabel: string;
  destructive?: boolean;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

/** Bottom sheet with a few text inputs, e.g. "Ban user · reason". Works on web, unlike Alert.prompt. */
export function FormSheet({ visible, title, message, fields, submitLabel, destructive, onSubmit, onClose }: FormSheetProps) {
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setValues(Object.fromEntries(fields.map((f) => [f.key, f.initialValue ?? ''])));
      setError(null);
      setBusy(false);
    }
  }, [visible]);

  const valid = fields.every((f) => (values[f.key] ?? '').trim().length >= (f.minLength ?? 1));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(Object.fromEntries(fields.map((f) => [f.key, (values[f.key] ?? '').trim()])));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Text variant="heading">{title}</Text>
          {message && (
            <Text variant="caption" color="muted">
              {message}
            </Text>
          )}
          {fields.map((field, i) => (
            <TextField
              key={field.key}
              label={field.label}
              placeholder={field.placeholder}
              keyboardType={field.keyboardType}
              multiline={field.multiline}
              maxLength={field.maxLength}
              value={values[field.key] ?? ''}
              onChangeText={(text) => setValues((v) => ({ ...v, [field.key]: text }))}
              autoFocus={i === 0}
            />
          ))}
          {error && (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          )}
          <View style={styles.actions}>
            <Button title="Cancel" variant="secondary" onPress={onClose} style={styles.flex} />
            <Button
              title={submitLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={submit}
              loading={busy}
              disabled={!valid}
              style={styles.flex}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  actions: { flexDirection: 'row', gap: spacing.md },
});
