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

it.each(['en','he'] as const)('exposes daily unknowns, converted weight, targets and hidden layers accessibly in %s',async language=>{
 await render(<I18nProvider initial={language}><TrendsChart period={period} metric="calories" weightUnit="lb"/></I18nProvider>);
 await fireEvent.press(screen.getByTestId('chart-data-toggle'));
 const missing=screen.getByTestId('chart-data-2026-10-12').props.accessibilityLabel;
 expect(missing).toContain(language==='en'?'Not provided':'לא צוין');
 const measured=screen.getByTestId('chart-data-2026-10-13').props.accessibilityLabel;
 expect(measured).toContain('153.2');expect(measured).toContain('lb');expect(measured).toContain('kcal');
 await fireEvent.press(screen.getByTestId('chart-weight'));
 expect(screen.getByTestId('chart-data-2026-10-13').props.accessibilityLabel).not.toContain('lb');
 await fireEvent.press(screen.getByTestId('chart-primary'));
 expect(screen.getByTestId('chart-data-2026-10-13').props.accessibilityLabel).not.toContain('kcal');
});

it('accessible daily data retains partial known totals and date-effective target',async()=>{
 const p={...period,days:[{...period.days[0],calories:null,partial:{...period.days[0].partial,calories:true},known_totals:{...period.days[0].known_totals,calories:50},targets:{calorie_target:2300}}]};
 await render(<I18nProvider initial="en"><TrendsChart period={p} metric="calories"/></I18nProvider>);await fireEvent.press(screen.getByTestId('chart-data-toggle'));
 const label=screen.getByTestId('chart-data-2026-10-11').props.accessibilityLabel;
 expect(label).toContain('Incomplete nutrients');expect(label).toContain('50 kcal');expect(label).toContain('2,300 kcal');
});
it('accessible water uses chosen fl oz unit without inventing missing dates',async()=>{
 const p={...period,days:[{...period.days[0],water:500},period.days[1]]};
 await render(<I18nProvider initial="en"><TrendsChart period={p} metric="water" waterUnit="fl oz"/></I18nProvider>);await fireEvent.press(screen.getByTestId('chart-data-toggle'));
 expect(screen.getByTestId('chart-data-2026-10-11').props.accessibilityLabel).toContain('16.9');
 expect(screen.getByTestId('chart-data-2026-10-12').props.accessibilityLabel).toContain('Not provided');
});
