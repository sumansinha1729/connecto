import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { closeDialog, useDialogStore } from '@/utils/dialog';
import { Button } from './Button';
import { Text } from './Text';

/** Draws the dialogs requested with `confirm()` / `notify()` from utils/dialog. Mounted once at the root. */
export function DialogHost() {
  const dialog = useDialogStore((s) => s.queue[0]);
  if (!dialog) return null;

  const cancel = () => closeDialog(dialog.id, false);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={cancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cancel} accessibilityLabel="Close" />
        <View style={styles.card} accessibilityRole="alert">
          <Text variant="heading" center>
            {dialog.title}
          </Text>
          {dialog.message ? (
            <Text variant="body" color="muted" center>
              {dialog.message}
            </Text>
          ) : null}
          <View style={styles.buttons}>
            {dialog.kind === 'confirm' && <Button title={dialog.cancelText} variant="secondary" onPress={cancel} style={styles.button} />}
            <Button
              title={dialog.confirmText}
              variant={dialog.destructive ? 'danger' : 'primary'}
              onPress={() => closeDialog(dialog.id, true)}
              style={styles.button}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.overlay,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  button: { flex: 1 },
});
