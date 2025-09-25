import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

export function LoadingView() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
});
