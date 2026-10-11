import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { errorMessageKey } from '@/api/messages';
import type { Candidate, Prediction } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { useDraft } from '@/data/DraftProvider';
import { getAddIntent } from '@/data/add-intent';
import { prepareUpload } from '@/data/images';
import { catalogDraft } from '@/domain/drafts';
import { useI18n } from '@/i18n/I18nProvider';
import { foodName } from '@/i18n/translate';
import type { TKey } from '@/i18n/translate';
import { colors, radius, spacing } from '@/theme/tokens';

type Stage =
  | { name: 'picking' }
  | { name: 'denied'; what: 'camera' | 'photos' }
  | { name: 'noCamera' }
  | { name: 'working'; uri: string; step: 'preparing' | 'analysing' }
  | { name: 'result'; uri: string; prediction: Prediction }
  | { name: 'failed'; uri: string | null; message: TKey };

/**
 * Take or choose a photo and ask the server for suggestions. The answer is only
 * ever a suggestion: the user picks the food here and enters the amount next.
 */
export default function PhotoSuggestions() {
  const { t, language } = useI18n();
  const { api } = useAuth();
  const { start, newKey } = useDraft();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const fromCamera = source !== 'library';
  const [stage, setStage] = useState<Stage>({ name: 'picking' });
  const [slow, setSlow] = useState(false);
  const run = useRef(0);

  const pick = useCallback(async () => {
    const current = ++run.current;
    try {
      if (fromCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setStage({ name: 'denied', what: 'camera' });
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
      let picked: ImagePicker.ImagePickerResult;
      try {
        picked = fromCamera
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      } catch {
        // Simulators and some tablets have no camera.
        setStage(fromCamera ? { name: 'noCamera' } : { name: 'denied', what: 'photos' });
        return;
      }
      if (current !== run.current) return;
      if (picked.canceled || !picked.assets?.length) {
        router.back();
        return;
      }
      const asset = picked.assets[0];
      setStage({ name: 'working', uri: asset.uri, step: 'preparing' });
      let upload;
      try {
        upload = await prepareUpload(asset);
      } catch {
        setStage({ name: 'failed', uri: asset.uri, message: 'photo.imageRejected' });
        return;
      }
      if (current !== run.current) return;
      setStage({ name: 'working', uri: asset.uri, step: 'analysing' });
      const slowTimer = setTimeout(() => current === run.current && setSlow(true), 8000);
      try {
        const prediction = await api.predict(upload);
        if (current === run.current) setStage({ name: 'result', uri: asset.uri, prediction });
      } catch (error) {
        if (current === run.current) {
          setStage({ name: 'failed', uri: asset.uri, message: errorMessageKey(error, 'photo') });
        }
      } finally {
        clearTimeout(slowTimer);
      }
    } catch {
      if (current === run.current) setStage({ name: 'failed', uri: null, message: 'errors.unknown' });
    }
  }, [api, fromCamera]);

  useEffect(() => {
    // Open the camera or photo picker once this screen has finished sliding in;
    // presenting it mid-transition is unreliable on iOS.
    const opening = setTimeout(() => void pick(), 350);
    return () => {
      clearTimeout(opening);
      run.current += 1;
    };
  }, [pick]);

  const retry = () => {
    setSlow(false);
    setStage({ name: 'picking' });
    void pick();
  };

  const choose = async (candidate: Candidate) => {
    await start(catalogDraft(newKey(), candidate.food_id, 'photo', getAddIntent()));
    router.replace('/add/review');
  };
  const toCatalog = () => router.replace('/add/catalog');
  const uri = 'uri' in stage ? stage.uri : null;

  return (
    <Screen header={<Header title={fromCamera ? t('add.camera') : t('add.library')} />}>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.photo}
          contentFit="cover"
          accessibilityLabel={t('a11y.photoPreview')}
        />
      ) : null}

      {stage.name === 'picking' ? <ActivityIndicator color={colors.sand} accessibilityLabel={t('common.loading')} /> : null}

      {stage.name === 'working' ? (
        <View style={styles.center} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.sand} />
          <AppText center>{stage.step === 'preparing' ? t('photo.preparing') : t('photo.analysing')}</AppText>
          {slow ? (
            <AppText variant="caption" color={colors.muted} center>
              {t('photo.analysingSlow')}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {stage.name === 'denied' ? (
        <Notice
          tone="warning"
          icon={stage.what === 'camera' ? 'camera-off' : 'image'}
          message={t(stage.what === 'camera' ? 'permissions.cameraDenied' : 'permissions.photosDenied')}>
          <Button kind="secondary" label={t('permissions.openSettings')} onPress={() => Linking.openSettings()} />
          <Button kind="ghost" label={t('photo.pickFromCatalog')} onPress={() => router.replace('/add/catalog')} />
        </Notice>
      ) : null}

      {stage.name === 'noCamera' ? (
        <Notice tone="warning" icon="camera-off" message={t('permissions.noCamera')}>
          <Button
            kind="secondary"
            label={t('add.library')}
            onPress={() => router.replace({ pathname: '/add/photo', params: { source: 'library' } })}
          />
          <Button kind="ghost" label={t('photo.pickFromCatalog')} onPress={() => router.replace('/add/catalog')} />
        </Notice>
      ) : null}

      {stage.name === 'failed' ? (
        <Notice tone="error" message={t(stage.message)}>
          <Button kind="secondary" label={t('photo.tryAnother')} onPress={retry} />
          <Button kind="ghost" label={t('photo.pickFromCatalog')} onPress={toCatalog} />
        </Notice>
      ) : null}

      {stage.name === 'result' ? (
        <>
          {stage.prediction.status === 'recognized' ? (
            <View style={styles.block}>
              <AppText variant="heading" accessibilityRole="header">
                {t('photo.suggestionsTitle')}
              </AppText>
              <AppText variant="caption" color={colors.muted}>
                {t('photo.recognisedNote')}
              </AppText>
            </View>
          ) : (
            <Notice
              tone="warning"
              title={t('photo.uncertainTitle')}
              message={
                stage.prediction.unmapped_label
                  ? t('photo.unmappedBody', { label: stage.prediction.unmapped_label.replace(/_/g, ' ') })
                  : t('photo.uncertainBody')
              }
            />
          )}

          {stage.prediction.candidates.length ? (
            <View style={styles.block}>
              {stage.prediction.status !== 'recognized' ? (
                <AppText variant="label" color={colors.muted}>
                  {t('photo.lowConfidence')}
                </AppText>
              ) : null}
              {stage.prediction.candidates.map((candidate) => {
                const name = foodName(language, candidate.food_id, candidate.name);
                const confidence = t('photo.confidence', { percent: Math.round(candidate.score * 100) });
                return (
                  <Pressable
                    key={candidate.food_id}
                    testID={`candidate-${candidate.food_id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${name}, ${confidence}`}
                    onPress={() => choose(candidate)}
                    style={({ pressed }) => [styles.candidate, pressed && styles.pressed]}>
                    <AppText style={styles.emoji} maxFontSizeMultiplier={1.3}>
                      {candidate.emoji}
                    </AppText>
                    <View style={styles.text}>
                      <AppText variant="bodyStrong">{name}</AppText>
                      <AppText variant="caption" color={colors.muted}>
                        {confidence}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <AppText variant="caption" color={colors.muted}>
            {t('photo.weightNote')} {t('photo.scopeNote')}
          </AppText>
          <Button kind="secondary" icon="list" label={t('photo.pickFromCatalog')} onPress={toCatalog} />
          <Button kind="ghost" label={t('photo.tryAnother')} onPress={retry} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.surface },
  center: { gap: spacing.md, alignItems: 'center', paddingVertical: spacing.lg },
  block: { gap: spacing.sm },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  pressed: { backgroundColor: colors.field },
  emoji: { fontSize: 26, lineHeight: 32 },
  text: { flex: 1 },
});
