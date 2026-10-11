import { Stack } from 'expo-router';

import { SheetContext } from '@/components/Screen';
import { colors } from '@/theme/tokens';

export default function AddLayout() {
  return (
    <SheetContext.Provider value>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }} />
    </SheetContext.Provider>
  );
}
