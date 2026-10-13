import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api/errors';
import { errorMessageKey } from '@/api/messages';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useDraft } from '@/data/DraftProvider';
import { getAddIntent } from '@/data/add-intent';
import { prepareUpload } from '@/data/images';
import { manualDraft } from '@/domain/drafts';
import { analysisFromResult } from '@/domain/meal-analysis';
import { parseDecimal } from '@/domain/validation';
import { useI18n } from '@/i18n/I18nProvider';
import type { TKey } from '@/i18n/translate';
import { colors, radius, spacing } from '@/theme/tokens';

export default function MealPhoto() {
  const { t, language } = useI18n();
  const { api, user } = useAuth();
  const { start, newKey } = useDraft();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const [first, setFirst] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [second, setSecond] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [plate, setPlate] = useState('');
  const [context, setContext] = useState('');
  const [enhanced, setEnhanced] = useState(false);
  const [busy, setBusy] = useState<'preparing' | 'analyzing' | null>(null);
  const [failure, setFailure] = useState<TKey | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [noFood, setNoFood] = useState(false);
  const [slow, setSlow] = useState(false);
  const key = useRef(newKey());
  const generation = useRef(0);
  const inFlight = useRef(false);
  const controller = useRef<AbortController|null>(null);
  const owner = useRef(user?.id);
  useEffect(() => { owner.current = user?.id; }, [user?.id]);

  const pick = useCallback(async (extra: boolean, camera: boolean) => {
    const current = generation.current;
    setFailure(null);
    setPermissionDenied(false);
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
        setPermissionDenied(true);
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
      const result = camera ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (current !== generation.current) return;
      if (result.canceled || !result.assets?.length) return;
      if (extra) setSecond(result.assets[0]);
      else { setFirst(result.assets[0]); setSecond(null); }
      setNoFood(false);
      key.current = newKey();
    } catch {
      if (current === generation.current) setFailure(camera ? 'permissions.noCamera' : 'photo.imageRejected');
    }
  }, [newKey]);

  useEffect(() => {
    const timer = setTimeout(() => void pick(false, source !== 'library'), 350);
    return () => { clearTimeout(timer); generation.current += 1; controller.current?.abort(); };
  }, [source, pick]);

  const diameter = plate.trim() ? parseDecimal(plate) : null;
  const invalidDiameter = !!plate.trim() && (diameter === null || !Number.isFinite(diameter)
    || diameter < 10 || diameter > 50);

  const analyze = async () => {
    if (!first || invalidDiameter || inFlight.current) return;
    inFlight.current = true;
    const requestController = new AbortController();
    controller.current = requestController;
    const current = generation.current;
    const userId = owner.current;
    const active = () => current === generation.current && userId === owner.current;
    const uploads: Awaited<ReturnType<typeof prepareUpload>>[] = [];
    setFailure(null); setNoFood(false); setSlow(false); setBusy('preparing');
    const timer = setTimeout(() => { if (active()) setSlow(true); }, 8000);
    try {
      const assertSession = api.captureSession();
      uploads.push(await prepareUpload(first, true));
      if (second) uploads.push(await prepareUpload(second, true));
      if (!active()) return;
      setBusy('analyzing');
      assertSession();
      const result = await api.analyzeMeal(uploads[0], uploads[1] ?? null,
        { language, plate_diameter_cm: diameter, context: context.trim() }, key.current, requestController.signal);
      assertSession();
      if (!active()) return;
      if (!result.foods.length) { setNoFood(true); return; }
      const draft = manualDraft(newKey(), getAddIntent());
      await start({ ...draft, name: result.meal_name, origin: 'photo', analysis: analysisFromResult(result) });
      if (active()) router.replace('/add/review');
    } catch (error) {
      if (active()) setFailure(isApiError(error) && error.detail?.startsWith('Free vision quota')
        ? 'analysis.quota' : isApiError(error) && ['unavailable', 'notFound'].includes(error.kind)
        ? 'analysis.unavailable' : errorMessageKey(error, 'photo'));
    } finally {
      clearTimeout(timer);
      uploads.forEach(upload => upload.dispose());
      if(controller.current === requestController) {
        inFlight.current = false; controller.current = null;
      }
      if (active()) setBusy(null);
    }
  };

  return <Screen header={<Header title={t('analysis.title')} />}>
    {first ? <Image source={{ uri: first.uri }} style={styles.photo} contentFit="contain"
      accessibilityLabel={t('a11y.photoPreview')} /> : null}
    {busy ? <View style={styles.block} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.sand} />
      <Button kind="secondary" label={t('common.cancel')} onPress={()=>{
        generation.current += 1; controller.current?.abort();
        // Stop accepting the response; consumed provider work is not refunded.
        setBusy(null); setFailure('unified.cancelled');
      }}/>
      <AppText center>{t(busy === 'preparing' ? 'photo.preparing' : 'analysis.working')}</AppText>
      {slow ? <AppText center variant="caption" color={colors.muted}>{t('photo.analysingSlow')}</AppText> : null}
    </View> : <>
      <AppText color={colors.muted}>{t('analysis.preview')}</AppText>
      {permissionDenied ? <Notice tone="warning" message={t('permissions.cameraDenied')}>
        <Button label={t('permissions.openSettings')} kind="secondary" onPress={() => Linking.openSettings()} />
      </Notice> : null}
      {failure ? <Notice tone="error" message={t(failure)} /> : null}
      {noFood ? <Notice tone="warning" message={t('analysis.noFood')} /> : null}
      <Button label={t(first ? 'photo.tryAnother' : 'add.camera')} kind="secondary"
        onPress={() => pick(false, true)} />
      <Button label={t('add.library')} kind="ghost" onPress={() => pick(false, false)} />
      {first ? <>
        <Button kind="ghost" label={t('analysis.optional')} onPress={() => setEnhanced(value => !value)} />
        {enhanced ? <View style={styles.block}>
          <TextField label={t('analysis.plate')} hint={t('analysis.plateHint')} value={plate}
            onChangeText={value => { setPlate(value); key.current = newKey(); }} maxLength={5}
            keyboardType="decimal-pad" ltr error={invalidDiameter ? t('analysis.plateHint') : null} />
          <TextField label={t('analysis.context')} hint={t('analysis.contextHint')} value={context}
            onChangeText={value => { setContext(value); key.current = newKey(); }} maxLength={500} multiline />
          <AppText variant="caption" color={colors.muted}>{t('analysis.secondHint')}</AppText>
          {second ? <>
            <Image source={{ uri: second.uri }} style={styles.second} contentFit="contain" />
            <Button label={t('analysis.removeSecond')} kind="ghost" onPress={() => { setSecond(null); key.current = newKey(); }} />
          </> : <>
            <Button label={t('analysis.second')} kind="secondary" onPress={() => pick(true, true)} />
            <Button label={t('analysis.secondLibrary')} kind="ghost" onPress={() => pick(true, false)} />
          </>}
        </View> : null}
        <AppText variant="caption" color={colors.muted}>{t('analysis.privacy')}</AppText>
        <Button label={t('analysis.privacyLink')} kind="ghost"
          onPress={() => Linking.openURL('https://ai.google.dev/gemini-api/terms#unpaid-services')} />
        <Button testID="analyze-meal" label={t(failure ? 'analysis.retry' : 'analysis.analyze')}
          disabled={invalidDiameter} onPress={analyze} icon="camera" />
      </> : null}
      <Button label={t('add.manual')} kind="ghost" onPress={async () => {
        await start(manualDraft(newKey(), getAddIntent())); router.replace('/add/review');
      }} />
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.surface },
  second: { width: '100%', height: 150, borderRadius: radius.md },
  block: { gap: spacing.md },
});
