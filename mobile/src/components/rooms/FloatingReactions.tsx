import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import type { FloatingReaction } from '@/store/roomStore';

const RISE = 260;

/** One emoji that drifts up, sways a little and fades out */
const Bubble = memo(function Bubble({ emoji, seed }: { emoji: string; seed: number }) {
  const t = useRef(new Animated.Value(0)).current;
  // Stable per-bubble randomness
  const x = ((seed * 37) % 60) - 30;
  const sway = ((seed * 13) % 2 === 0 ? 1 : -1) * 14;
  const size = 26 + ((seed * 7) % 10);

  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 2400, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [t]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bubble,
        {
          opacity: t.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [x, x + sway, x - sway / 2] }) },
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -RISE] }) },
            { scale: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.4, 1.15, 1] }) },
          ],
        },
      ]}
    >
      <Text style={{ fontSize: size }}>{emoji}</Text>
    </Animated.View>
  );
});

/** Overlay where reactions from everyone in the room float up */
export function FloatingReactions({ reactions }: { reactions: FloatingReaction[] }) {
  return (
    <View pointerEvents="none" style={styles.layer}>
      {reactions.map((r) => (
        <Bubble key={r.id} emoji={r.emoji} seed={r.id} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', right: 24, bottom: 0, width: 80, height: RISE + 40 },
  bubble: { position: 'absolute', bottom: 0, left: 20 },
});
