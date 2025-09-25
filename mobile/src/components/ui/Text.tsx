import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, fontSize } from '@/theme';

type Variant = 'hero' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'label';
type Color = 'default' | 'muted' | 'faint' | 'primary' | 'danger' | 'success' | 'coin' | 'white';

export interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: Color;
  center?: boolean;
}

const COLOR: Record<Color, string> = {
  default: colors.text,
  muted: colors.textMuted,
  faint: colors.textFaint,
  primary: colors.primary,
  danger: colors.danger,
  success: colors.success,
  coin: colors.coin,
  white: colors.white,
};

export function Text({ variant = 'body', color = 'default', center, style, ...rest }: TextProps) {
  return (
    <RNText
      style={[styles[variant], { color: COLOR[color] }, center && styles.center, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  hero: { fontSize: fontSize.hero, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: fontSize.xxl, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: fontSize.lg, fontWeight: '700' },
  body: { fontSize: fontSize.md, lineHeight: 22 },
  bodyStrong: { fontSize: fontSize.md, fontWeight: '600' },
  caption: { fontSize: fontSize.sm, lineHeight: 19 },
  label: { fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  center: { textAlign: 'center' },
});
