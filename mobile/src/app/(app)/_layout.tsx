import {NotificationLifecycle} from '@/components/NotificationLifecycle';
import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

export default function AppLayout() {
  return (
    <><NotificationLifecycle/><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="reminders" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="water" />
      <Stack.Screen name="weight" />
      <Stack.Screen name="trends" />
      <Stack.Screen name="insights" />
      <Stack.Screen name="recommendations" />
      <Stack.Screen name="food-restrictions" />
      <Stack.Screen name="library" />
      <Stack.Screen name="copy" />
      <Stack.Screen name="recipes/index" />
      <Stack.Screen name="recipes/[id]" />
      <Stack.Screen name="meal/[id]" />
      {/* Adding a meal is a self-contained task, shown as a modal on both systems. */}
      <Stack.Screen name="add" options={{ presentation: 'modal' }} />
    </Stack></>
  );
}
