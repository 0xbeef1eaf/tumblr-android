import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';

/** Cold start lands on Dashboard; `index` (Explore) stays routable at `/`. */
export const unstable_settings = { initialRouteName: 'dashboard' };

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
  const { colors } = useTheme();

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
      {/* Tab order is the order of these entries (DESIGN §2). Dashboard and For You are
          always shown; guests see a sign-in prompt there. */}
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Dashboard', tabBarIcon: tabIcon('albums-outline', 'albums') }}
      />
      <Tabs.Screen
        name="for-you"
        options={{ title: 'For You', tabBarIcon: tabIcon('sparkles-outline', 'sparkles') }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: tabIcon('notifications-outline', 'notifications'),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{ title: 'Explore', tabBarIcon: tabIcon('compass-outline', 'compass') }}
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
