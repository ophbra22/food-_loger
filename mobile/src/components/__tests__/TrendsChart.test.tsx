import {render,screen,fireEvent} from '@testing-library/react-native';
import {TrendsChart} from '../TrendsChart';
import {I18nProvider} from '@/i18n/I18nProvider';
import type {TrendPeriod} from '@/domain/trends';
import fixture from '@/test-fixtures/trends.json';
const period=fixture.current as TrendPeriod;
it.each(['en','he'] as const)('E2E-11/20 charts show distinct axes, gaps and toggleable measured points in %s',async language=>{
 await render(<I18nProvider initial={language}><TrendsChart period={period} metric="calories" weightUnit="lb"/></I18nProvider>);
 expect(screen.getByTestId('chart-left-axis')).toBeTruthy();expect(screen.getByTestId('chart-right-axis').props.children).toContain('lb');
 expect(screen.queryByTestId('point-2026-10-12')).toBeNull();expect(screen.queryByTestId('weight-point-2026-10-12')).toBeNull();
 expect(screen.getByTestId('weight-point-2026-10-13')).toBeTruthy();
 await fireEvent.press(screen.getByTestId('chart-weight'));expect(screen.queryByTestId('weight-point-2026-10-13')).toBeNull();
 expect(screen.getByTestId('point-2026-10-13')).toBeTruthy();
});
