import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { LISTENER_EARNING_PAISE_PER_MIN } from '@/constants/config';
import { colors, gradients, radius, spacing } from '@/theme';
import { formatRupees } from '@/utils/format';

interface RoleChoiceProps {
  onChoose: (role: 'user' | 'listener') => void;
  disabled?: boolean;
}

const OPTIONS: { role: 'user' | 'listener'; icon: IconName; title: string; text: string }[] = [
  {
    role: 'user',
    icon: 'chatbubbles',
    title: 'I want to talk to someone',
    text: 'Call caring, verified listeners anytime. Stay anonymous with an avatar.',
  },
  {
    role: 'listener',
    icon: 'headset',
    title: 'I want to become a listener',
    text: `Help people feel heard and earn ${formatRupees(LISTENER_EARNING_PAISE_PER_MIN)} per minute. Our team reviews every listener.`,
  },
];

export function RoleChoice({ onChoose, disabled }: RoleChoiceProps) {
  return (
    <View style={styles.list}>
      {OPTIONS.map((option, i) => (
        <Pressable
          key={option.role}
          onPress={() => onChoose(option.role)}
          disabled={disabled}
          accessibilityRole="button"
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        >
          {i === 0 ? (
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconWrap}>
              <Icon name={option.icon} size={28} color={colors.white} />
            </LinearGradient>
          ) : (
            <View style={[styles.iconWrap, styles.iconAlt]}>
              <Icon name={option.icon} size={28} color={colors.primary} />
            </View>
          )}
          <View style={styles.text}>
            <Text variant="heading">{option.title}</Text>
            <Text variant="caption" color="muted">
              {option.text}
            </Text>
          </View>
          <Icon name="chevron-forward" size={20} color={colors.textFaint} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  iconAlt: { backgroundColor: colors.primarySoft },
  text: { flex: 1, gap: spacing.xs },
});
