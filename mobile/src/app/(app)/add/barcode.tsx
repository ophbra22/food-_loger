import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api/errors';
import { errorMessageKey } from '@/api/messages';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useDraft } from '@/data/DraftProvider';
import { getAddIntent } from '@/data/add-intent';
import { prepareUpload } from '@/data/images';
import { manualDraft, productDraft } from '@/domain/drafts';
import { validateBarcode } from '@/domain/validation';
import { useI18n } from '@/i18n/I18nProvider';
import { ltr } from '@/i18n/format';
import type { TKey } from '@/i18n/translate';
import { colors, radius, spacing } from '@/theme/tokens';

type Status =
  | { name: 'idle' }
  | { name: 'looking'; barcode: string }
  | { name: 'reading' }
  | { name: 'notFound'; barcode: string }
  | { name: 'unavailable'; barcode: string }
  | { name: 'error'; message: TKey };

/** Find a packaged product: scan with the camera, type the digits, or read a photo of the barcode. */
export default function BarcodeLookup() {
  const { t } = useI18n();
  const { api } = useAuth();
  const { start, newKey } = useDraft();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<Status>({ name: 'idle' });
  const [digits, setDigits] = useState('');
  const [digitsError, setDigitsError] = useState<TKey | null>(null);
  const [torch, setTorch] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const busy = useRef(false);

  const lookUp = async (barcode: string) => {
    if (busy.current) return;
    busy.current = true;
    setStatus({ name: 'looking', barcode });
    try {
      const product = await api.product(barcode);
      await start(productDraft(newKey(), product, getAddIntent()));
      router.replace('/add/review');
    } catch (error) {
      if (isApiError(error) && error.kind === 'notFound') setStatus({ name: 'notFound', barcode });
      else if (isApiError(error) && error.kind === 'unavailable') setStatus({ name: 'unavailable', barcode });
      else setStatus({ name: 'error', message: errorMessageKey(error, 'product') });
    } finally {
      busy.current = false;
    }
  };

  const onScanned = ({ data }: { data: string }) => {
    // The camera reports the same code many times a second; act on the first valid one.
    if (busy.current || status.name !== 'idle') return;
    const code = data.trim();
    if (validateBarcode(code) === null) void lookUp(code);
  };

  const submitDigits = () => {
    const code = digits.replace(/\s+/g, '');
    const problem = validateBarcode(code);
    setDigitsError(problem);
    if (!problem) void lookUp(code);
  };

  const fromPhoto = async () => {
    if (busy.current) return;
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (picked.canceled || !picked.assets?.length) return;
      setStatus({ name: 'reading' });
      const upload = await prepareUpload(picked.assets[0]);
      const { barcode } = await api.scanBarcode(upload);
      await lookUp(barcode);
    } catch (error) {
      setStatus({
        name: 'error',
        message: isApiError(error) ? errorMessageKey(error, 'barcodePhoto') : 'barcode.noBarcodeInPhoto',
      });
    }
  };

  const enterManually = async () => {
    await start(manualDraft(newKey(), getAddIntent()));
    router.replace('/add/review');
  };

  const working = status.name === 'looking' || status.name === 'reading';
  const canScan = permission?.granted && !cameraFailed;

  return (
    <Screen header={<Header title={t('barcode.title')} />}>
      {canScan ? (
        <View style={styles.camera}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            active={status.name === 'idle'}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={status.name === 'idle' ? onScanned : undefined}
            onMountError={() => setCameraFailed(true)}
            accessibilityLabel={t('a11y.scanner')}
          />
          <View style={styles.frame} pointerEvents="none" />
          <View style={styles.torch}>
            <IconButton
              icon={torch ? 'zap-off' : 'zap'}
              label={torch ? t('barcode.torchOff') : t('barcode.torchOn')}
              filled
              onPress={() => setTorch((value) => !value)}
            />
          </View>
        </View>
      ) : null}
      {canScan && status.name === 'idle' ? (
        <AppText variant="caption" color={colors.muted} center>
          {t('barcode.aim')}
        </AppText>
      ) : null}

      {permission && !permission.granted && permission.canAskAgain ? (
        <Notice icon="camera" title={t('permissions.cameraTitle')} message={t('permissions.cameraBody')}>
          <Button testID="allow-camera" label={t('permissions.allow')} onPress={requestPermission} />
        </Notice>
      ) : null}
      {permission && !permission.granted && !permission.canAskAgain ? (
        <Notice tone="warning" icon="camera-off" message={t('permissions.cameraDenied')}>
          <Button kind="secondary" label={t('permissions.openSettings')} onPress={() => Linking.openSettings()} />
        </Notice>
      ) : null}
      {cameraFailed ? <Notice tone="warning" icon="camera-off" message={t('barcode.simulatorNote')} /> : null}

      {working ? (
        <View style={styles.center} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.sand} />
          <AppText center>
            {status.name === 'looking'
              ? t('barcode.lookingUp', { barcode: ltr(status.barcode) })
              : t('barcode.readingPhoto')}
          </AppText>
        </View>
      ) : null}

      {status.name === 'notFound' ? (
        <Notice
          tone="warning"
          title={t('barcode.notFoundTitle')}
          message={t('barcode.notFoundBody', { barcode: ltr(status.barcode) })}>
          <Button testID="enter-manually" label={t('barcode.enterManually')} onPress={enterManually} />
          <Button kind="ghost" label={t('barcode.scanAgain')} onPress={() => setStatus({ name: 'idle' })} />
        </Notice>
      ) : null}
      {status.name === 'unavailable' ? (
        <Notice tone="error" title={t('barcode.unavailableTitle')} message={t('barcode.unavailableBody')}>
          <Button kind="secondary" label={t('common.retry')} onPress={() => lookUp(status.barcode)} />
          <Button kind="ghost" label={t('barcode.enterManually')} onPress={enterManually} />
        </Notice>
      ) : null}
      {status.name === 'error' ? (
        <Notice tone="error" message={t(status.message)}>
          <Button kind="secondary" label={t('barcode.scanAgain')} onPress={() => setStatus({ name: 'idle' })} />
        </Notice>
      ) : null}

      <View style={styles.manual}>
        <TextField
          testID="barcode-digits"
          label={t('barcode.digitsLabel')}
          hint={t('barcode.digitsHint')}
          value={digits}
          onChangeText={(text) => {
            setDigits(text.replace(/[^\d\s]/g, ''));
            setDigitsError(null);
          }}
          error={digitsError ? t(digitsError) : null}
          ltr
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={18}
          returnKeyType="search"
          onSubmitEditing={submitDigits}
          editable={!working}
        />
        <Button
          testID="barcode-lookup"
          kind="secondary"
          icon="search"
          label={t('barcode.lookUp')}
          onPress={submitDigits}
          disabled={working}
        />
        <Button kind="ghost" icon="image" label={t('barcode.fromPhoto')} onPress={fromPhoto} disabled={working} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: '78%',
    height: '46%',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.sand,
    opacity: 0.85,
  },
  torch: { position: 'absolute', bottom: spacing.sm, right: spacing.sm },
  center: { gap: spacing.md, alignItems: 'center', paddingVertical: spacing.md },
  manual: { gap: spacing.md },
});
