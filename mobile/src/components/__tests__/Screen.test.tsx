import { fireEvent, render, screen } from '@testing-library/react-native';
import { RefreshControl, Text } from 'react-native';
import { Screen } from '../Screen';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

it('attaches refresh after native scroll layout and forwards a pull to the selected-day callback', async () => {
  let selectedDay = '2026-10-10';
  const requests: string[] = [];
  await render(
    <Screen refreshControl={<RefreshControl testID="refresh" refreshing={false} onRefresh={() => requests.push(selectedDay)} />}>
      <Text>Empty journal</Text>
    </Screen>,
  );
  expect(screen.root!.queryAll(n => n.type === 'RCTRefreshControl')).toHaveLength(0);
  await fireEvent(screen.getByTestId('screen-scroll'), 'layout', { nativeEvent: { layout: { height: 700 } } });
  await fireEvent(screen.root!.queryAll(n => n.type === 'RCTRefreshControl')[0], 'refresh');
  selectedDay = '2026-10-11';
  await fireEvent(screen.root!.queryAll(n => n.type === 'RCTRefreshControl')[0], 'refresh');
  expect(requests).toEqual(['2026-10-10', '2026-10-11']);
});

