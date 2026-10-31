import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { useSession } from '@/features/auth';
import { Icon, type IconName } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';

function tabIcon(name: IconName, focusedName: IconName) {
  function TabIcon({
    color,
    focused,
    size,
  }: {
    color: ColorValue;
    focused: boolean;
    size: number;
  }) {
    const tint = typeof color === 'string' ? color : undefined;
    return <Icon name={focused ? focusedName : name} color={tint} size={size} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const { status } = useSession();
  const { colors } = useTheme();
  const signedIn = status === 'signedIn';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Explore', tabBarIcon: tabIcon('compass-outline', 'compass') }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          href: signedIn ? undefined : null,
          tabBarIcon: tabIcon('albums-outline', 'albums'),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: 'Search', tabBarIcon: tabIcon('search-outline', 'search') }}
      />
      <Tabs.Screen
        name="likes"
        options={{ title: 'Likes', tabBarIcon: tabIcon('heart-outline', 'heart') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: tabIcon('settings-outline', 'settings') }}
      />
    </Tabs>
  );
}
