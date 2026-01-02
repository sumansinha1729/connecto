import { Tabs } from 'expo-router/js-tabs';
import { Platform } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import { selectIsAdmin, selectIsListener, useAuthStore } from '@/store/authStore';
import { colors } from '@/theme';

type Audience = 'user' | 'listener' | 'everyone' | 'admin';

/** Users and listeners get different tabs; admins also see the Admin tab */
const TABS: { name: string; title: string; icon: IconName; iconActive: IconName; for: Audience }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconActive: 'home', for: 'user' },
  { name: 'listener', title: 'Home', icon: 'home-outline', iconActive: 'home', for: 'listener' },
  { name: 'rooms', title: 'Rooms', icon: 'mic-outline', iconActive: 'mic', for: 'everyone' },
  { name: 'history', title: 'Calls', icon: 'call-outline', iconActive: 'call', for: 'everyone' },
  { name: 'wallet', title: 'Wallet', icon: 'wallet-outline', iconActive: 'wallet', for: 'user' },
  { name: 'earnings', title: 'Earnings', icon: 'cash-outline', iconActive: 'cash', for: 'listener' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', iconActive: 'person', for: 'everyone' },
  { name: 'dashboard', title: 'Admin', icon: 'shield-outline', iconActive: 'shield', for: 'admin' },
];

export default function TabsLayout() {
  const isAdmin = useAuthStore(selectIsAdmin);
  const isListener = useAuthStore(selectIsListener);

  const visible = (audience: Audience) =>
    audience === 'everyone' || (audience === 'admin' ? isAdmin : audience === 'listener' ? isListener : !isListener);

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
            // `href: null` hides the tab entirely
            ...(!visible(tab.for) && { href: null }),
            tabBarIcon: ({ color, focused, size }) => (
              <Icon name={focused ? tab.iconActive : tab.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
