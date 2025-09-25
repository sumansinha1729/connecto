import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type RefreshControlProps, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView */
  scroll?: boolean;
  /** Apply the standard horizontal padding */
  padded?: boolean;
  edges?: Edge[];
  /** Avoid the keyboard on screens with inputs */
  keyboard?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top', 'bottom'],
  keyboard = false,
  refreshControl,
  contentStyle,
  footer,
}: ScreenProps) {
  const padding = padded ? styles.padded : null;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[padding, styles.scrollContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padding, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.root} edges={edges}>
      {keyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {body}
          {footer && <View style={[styles.footer, padding]}>{footer}</View>}
        </KeyboardAvoidingView>
      ) : (
        <>
          {body}
          {footer && <View style={[styles.footer, padding]}>{footer}</View>}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg },
  scrollContent: { paddingBottom: spacing.xl },
  footer: { paddingTop: spacing.md, paddingBottom: spacing.md },
});
