import {useTracking} from '@/data/useTracking';
import {WaterToday} from '@/components/WaterToday';
import {resumeDraftPath} from '@/domain/drafts';
import { GoalDashboard } from '@/components/GoalDashboard';
import { useGoals } from '@/data/useGoals';
import {effectiveGoal,goalProgress} from '@/domain/goals';
import { DraftPersistenceNotice } from '@/components/DraftPersistenceNotice';
import { File, Paths } from 'expo-file-system';
import { router,useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';

import { errorMessageKey } from '@/api/messages';
import type { Meal } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { DayDial } from '@/components/DayDial';
import { DayNav } from '@/components/DayNav';
import { IconButton } from '@/components/IconButton';
import { MealRow } from '@/components/MealRow';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { useDraft } from '@/data/DraftProvider';
import { setAddIntent } from '@/data/add-intent';
import { useDay } from '@/data/useDay';
import { addDays, todayIso,isIsoDay } from '@/domain/dates';
import { macroEnergyShare } from '@/domain/nutrition';
import { useOnline } from '@/hooks/useOnline';
import { useI18n } from '@/i18n/I18nProvider';
import { formatNumber, formatQuantity, formatTime } from '@/i18n/format';
import { foodName } from '@/i18n/translate';
import { colors, radius, spacing } from '@/theme/tokens';

export default function Home() {
 const {day:requestedDay}=useLocalSearchParams<{day?:string}>();
 return <HomeDay key={requestedDay??'current'} initialDay={isIsoDay(requestedDay)?requestedDay:todayIso()}/>;
}
function HomeDay({initialDay}:{initialDay:string}) {
  const { t, language } = useI18n();
  const { api } = useAuth();
  const online = useOnline();
  const { draft, discard } = useDraft();
  const [day,setDay]=useState(initialDay);
  const { data, loading, fresh, savedAt, error, refresh } = useDay(day);
  const [pulling, setPulling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const tracking=useTracking('water',day);
  const isToday = day === todayIso();
  const meals = data?.meals ?? [];
  const summary = data?.summary ?? null;
  const goals = useGoals();
  const goal = effectiveGoal(goals.data,day);
  const progress = goals.enabled && summary ? goalProgress(summary,goal):null;
  const share = summary ? macroEnergyShare(summary) : null;

  const startAdd = () => {
    setAddIntent({ day });
    router.push('/add');
  };
  const openMeal = (meal: Meal) =>
    router.push({ pathname: '/meal/[id]', params: { id: meal.id, day: meal.day } });

  const exportDay = async () => {
    setExportError(null);
    if (!meals.length) {
      setExportError(t('journal.exportEmpty'));
      return;
    }
    setExporting(true);
    try {
      const csv = await api.exportCsv(day);
      const file = new File(Paths.cache, `biteflow-${day}.csv`);
      if (file.exists) file.delete();
      file.create();
      file.write(csv);
      if (!(await Sharing.isAvailableAsync())) {
        setExportError(t('journal.shareUnavailable'));
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
        dialogTitle: t('journal.shareTitle', { day }),
      });
    } catch (failure) {
      const key = errorMessageKey(failure);
      setExportError(key === 'errors.unknown' ? t('journal.exportFailed') : t(key));
    } finally {
      setExporting(false);
    }
  };

  const savedTime = savedAt ? formatTime(language, savedAt) : '';
  const draftName = draft
    ? draft.foodId
      ? foodName(language, draft.foodId, draft.name)
      : draft.name.trim() || t('add.untitled')
    : '';

  return (
    <Screen
      header={
        <View style={styles.header}>
          <DayNav day={day} onChange={setDay} />
          <View style={styles.actions}>
            {exporting ? (
              <View style={styles.spinner} accessibilityLabel={t('journal.exporting')}>
                <ActivityIndicator color={colors.sand} />
              </View>
            ) : (
              <IconButton testID="export" icon="share" label={t('journal.export')} onPress={exportDay} />
            )}
            <IconButton
              testID="settings"
              icon="sliders"
              label={t('home.openSettings')}
              onPress={() => router.push('/settings')}
            />
          </View>
        </View>
      }
      refreshControl={
        <RefreshControl
          key={day}
          refreshing={pulling}
          tintColor={colors.sand}
          colors={[colors.ground]}
          progressBackgroundColor={colors.sage}
          onRefresh={async () => {
            setPulling(true);
            try { await refresh(); } finally { setPulling(false); }
          }}
        />
      }>
      <DraftPersistenceNotice />
      {!online ? <Notice tone="warning" icon="wifi-off" message={t('states.offline')} /> : null}

      {draft ? (
        <Notice
          row
          tone="warning"
          icon="edit-3"
          title={t('add.resumeTitle')}
          message={t('add.resumeBody', { name: draftName })}>
          <Button compact testID="resume-draft" label={t('add.resume')} onPress={() => router.push(resumeDraftPath(draft))} />
          <Button compact kind="ghost" label={t('add.discard')} onPress={discard} />
        </Notice>
      ) : null}

      {!isToday ? (
        <View style={styles.today}>
          <Button kind="secondary" icon="corner-up-left" label={t('dates.backToToday')} onPress={() => setDay(todayIso())} />
        </View>
      ) : null}

      <Button kind="secondary" label={t('copy.yesterday')} onPress={()=>router.push({pathname:'/copy',params:{source:addDays(day,-1),destination:day}})}/>
      <Button kind="ghost" label={t('copy.entireDay')} onPress={()=>router.push({pathname:'/copy',params:{source:day,destination:addDays(day,1)}})}/>
      <DayDial meals={meals} onAdd={startAdd} onOpenMeal={openMeal} caloriesGoal={progress?.calories}/>
      {goals.enabled && goals.saving?<Notice message={t('goals.pending')}/>:null}
      {goals.enabled && !goals.fresh && !goals.loading?<Notice tone="warning" message={t('goals.stale')}/>:null}
      {goals.enabled && summary?<GoalDashboard summary={summary} goal={goal} hideWater={tracking.enabled===true} onEdit={()=>router.push('/goals')}/>:

      <View
        style={styles.totals}
        accessible
        accessibilityLabel={
          summary
            ? `${t('a11y.dailyTotals')}: ${formatQuantity(language, summary.calories, 'kcal', 0)}. ${t('nutrients.protein')} ${formatQuantity(language, summary.protein, 'g', 0)}, ${t('nutrients.carbs')} ${formatQuantity(language, summary.carbs, 'g', 0)}, ${t('nutrients.fat')} ${formatQuantity(language, summary.fat, 'g', 0)}. ${t('home.items', { count: summary.count })}`
            : t('a11y.dailyTotals')
        }>
        <AppText variant="caption" color={colors.muted} center>
          {isToday ? t('home.soFarToday') : t('home.loggedOnDay')}
        </AppText>
        <View style={styles.kcal}>
          <AppText variant="display">{summary ? formatNumber(language, summary.calories) : '–'}</AppText>
          <AppText variant="body" color={colors.muted}>
            {t('units.kcal')}
          </AppText>
        </View>
        <View style={styles.chips}>
          {(['protein', 'carbs', 'fat'] as const).map((key) => (
            <View key={key} style={styles.chip}>
              <AppText variant="caption" color={colors.muted}>
                {key === 'carbs' ? t('nutrients.carbsShort') : t(`nutrients.${key}`)}
              </AppText>
              <AppText variant="label">
                {summary ? formatQuantity(language, summary[key], 'g', 0) : '–'}
              </AppText>
            </View>
          ))}
        </View>
        {share ? (
          <View
            style={styles.split}
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('home.macroSplit', {
              protein: Math.round(share.protein * 100),
              carbs: Math.round(share.carbs * 100),
              fat: Math.round(share.fat * 100),
            })}>
            <View style={[styles.bar, { flex: share.protein, backgroundColor: colors.sage }]} />
            <View style={[styles.bar, { flex: share.carbs, backgroundColor: colors.butter }]} />
            <View style={[styles.bar, { flex: share.fat, backgroundColor: colors.rose }]} />
          </View>
        ) : null}
      </View>

      }

      <WaterToday day={day} target={goal?.water_ml??null}/>
      <View style={styles.chips}>
        <Button kind="secondary" label={t('tracking.weight')} onPress={()=>router.push({pathname:'/weight',params:{day}})}/>
        <Button kind="secondary" label={t('tracking.trends')} onPress={()=>router.push({pathname:'/trends',params:{day}})}/>
      </View>
      {exportError ? <Notice tone="warning" message={exportError} /> : null}

      {data && !fresh && !loading ? (
        <Notice
          tone="warning"
          icon="cloud-off"
          message={t(online ? 'states.staleSaved' : 'states.offlineSaved', { time: savedTime })}>
          <Button kind="secondary" label={t('common.retry')} onPress={refresh} />
        </Notice>
      ) : null}

      {!data && loading ? (
        <View style={styles.center} accessibilityLabel={t('common.loading')}>
          <ActivityIndicator color={colors.sand} />
        </View>
      ) : null}

      {!data && !loading && error ? (
        <Notice
          tone="error"
          title={t('states.loadFailedTitle')}
          message={error.outcomeUnknown && !online ? t('states.offlineNoData') : t(errorMessageKey(error))}>
          <Button kind="secondary" label={t('common.retry')} onPress={refresh} />
        </Notice>
      ) : null}

      {data && meals.length === 0 ? (
        <View style={styles.empty}>
          <AppText variant="heading" center>
            {t('home.emptyTitle')}
          </AppText>
          <AppText variant="body" color={colors.muted} center>
            {t('home.emptyBody')}
          </AppText>
        </View>
      ) : null}

      <View style={styles.list}>
        {meals.map((meal) => (
          <MealRow key={meal.id} meal={meal} onPress={() => openMeal(meal)} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  actions: { flexDirection: 'row', alignItems: 'center' },
  spinner: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  today: { alignSelf: 'center' },
  totals: { alignItems: 'center', gap: spacing.sm },
  kcal: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  split: { flexDirection: 'row', gap: 4, height: 8, width: '70%', marginTop: spacing.xs },
  bar: { borderRadius: 4, minWidth: 4 },
  center: { paddingVertical: spacing.xl },
  empty: { gap: spacing.xs, paddingVertical: spacing.lg },
  list: { gap: spacing.sm },
});
