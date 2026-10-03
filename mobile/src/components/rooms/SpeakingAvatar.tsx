import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui';

interface SpeakingAvatarProps {
  avatar: string;
  size: number;
  speaking: boolean;
  /** Ring colour, e.g. the room theme's accent */
  color: string;
}

/** Avatar with soft rings that pulse outwards while the person is talking */
export function SpeakingAvatar({ avatar, size, speaking, color }: SpeakingAvatarProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!speaking) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
    );
    loop.start();
    return () => loop.stop();
  }, [speaking, pulse]);

  const ring = (delay: number) => {
    const progress = pulse.interpolate({ inputRange: [0, 1], outputRange: [delay, 1 + delay] });
    return {
      transform: [{ scale: progress.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 1.35, 1.35] }) }],
      opacity: progress.interpolate({ inputRange: [0, 0.2, 1, 2], outputRange: [0, 0.55, 0, 0] }),
    };
  };

  return (
    <View style={{ width: size, height: size }}>
      {speaking && (
        <>
          <Animated.View pointerEvents="none" style={[styles.ring, { borderRadius: size / 2, borderColor: color }, ring(0)]} />
          <Animated.View pointerEvents="none" style={[styles.ring, { borderRadius: size / 2, borderColor: color }, ring(0.5)]} />
        </>
      )}
      <View style={[styles.frame, { borderRadius: size / 2, borderColor: speaking ? color : 'transparent' }]}>
        <Avatar avatar={avatar} size={size - 6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 3 },
  frame: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
});
