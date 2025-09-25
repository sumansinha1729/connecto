import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { avatarUrl } from '@/constants/avatars';
import { colors } from '@/theme';

interface AvatarProps {
  avatar: string;
  size?: number;
  /** Shows a green presence dot */
  online?: boolean;
  /** Highlights the avatar, e.g. while the person is speaking */
  ring?: boolean;
}

export function Avatar({ avatar, size = 48, online, ring }: AvatarProps) {
  const dot = Math.max(10, size * 0.24);

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.frame,
          { width: size, height: size, borderRadius: size / 2 },
          ring && { borderColor: colors.success, borderWidth: Math.max(2, size * 0.05) },
        ]}
      >
        <Image
          source={{ uri: avatarUrl(avatar, Math.min(512, Math.round(size * 2))) }}
          style={styles.image}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
      </View>
      {online !== undefined && (
        <View
          style={[
            styles.dot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: online ? colors.success : colors.textFaint,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  image: { width: '100%', height: '100%' },
  dot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: colors.bg,
  },
});
