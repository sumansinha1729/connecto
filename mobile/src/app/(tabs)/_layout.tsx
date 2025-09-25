import { Tabs } from 'expo-router/js-tabs';
import { Platform } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import { colors } from '@/theme';

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'rooms', title: 'Rooms', icon: 'mic-outline', iconActive: 'mic' },
  { name: 'history', title: 'Calls', icon: 'call-outline', iconActive: 'call' },
  { name: 'wallet', title: 'Wallet', icon: 'wallet-outline', iconActive: 'wallet' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          // Web has no safe-area inset, so the default height clips the labels
          ...(Platform.OS === 'web' && { height: 60, paddingBottom: 6 }),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused, size }) => (
              <Icon name={focused ? tab.iconActive : tab.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
