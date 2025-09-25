import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface SheetAction {
  label: string;
  icon: IconName;
  onPress: () => void;
  destructive?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}

export function ActionSheet({ visible, title, actions, onClose }: ActionSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.handle} />
        {title && (
          <Text variant="caption" color="muted" center style={styles.title}>
            {title}
          </Text>
        )}
        {actions.map((action) => (
          <Pressable
            key={action.label}
            onPress={() => {
              onClose();
              action.onPress();
            }}
            style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surfaceAlt }]}
          >
            <Icon name={action.icon} size={20} color={action.destructive ? colors.danger : colors.text} />
            <Text variant="bodyStrong" style={{ color: action.destructive ? colors.danger : colors.text }}>
              {action.label}
            </Text>
          </Pressable>
        ))}
        <Pressable onPress={onClose} style={({ pressed }) => [styles.action, styles.cancel, pressed && { opacity: 0.7 }]}>
          <Text variant="bodyStrong" color="muted">
            Cancel
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  title: { paddingVertical: spacing.sm },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
  },
  cancel: { justifyContent: 'center', marginTop: spacing.xs },
});
