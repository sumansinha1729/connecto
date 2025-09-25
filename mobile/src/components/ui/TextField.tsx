import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/theme';
import { Text } from './Text';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  prefix?: string;
  hint?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, prefix, hint, style, multiline, ...rest },
  ref,
) {
  return (
    <View style={styles.wrapper}>
      {label && (
        <Text variant="label" color="muted">
          {label}
        </Text>
      )}
      <View style={[styles.field, multiline && styles.multiline, error ? styles.fieldError : null]}>
        {prefix && (
          <Text variant="bodyStrong" color="muted" style={styles.prefix}>
            {prefix}
          </Text>
        )}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.primary}
          multiline={multiline}
          style={[styles.input, multiline && styles.inputMultiline, style]}
          {...rest}
        />
      </View>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="faint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  multiline: { alignItems: 'flex-start', paddingVertical: spacing.md },
  fieldError: { borderColor: colors.danger },
  prefix: { marginRight: spacing.sm },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.md,
    paddingVertical: spacing.md,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top', paddingVertical: 0 },
});
