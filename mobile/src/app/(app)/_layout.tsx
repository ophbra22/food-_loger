import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="library" />
      <Stack.Screen name="meal/[id]" />
      {/* Adding a meal is a self-contained task, shown as a modal on both systems. */}
      <Stack.Screen name="add" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
