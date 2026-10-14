import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Icon, IconName, directional } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { useDraft } from '@/data/DraftProvider';
import { getAddIntent } from '@/data/add-intent';
import { useCatalog } from '@/data/catalog';
import { manualDraft, resumeDraftPath } from '@/domain/drafts';
import { useOnline } from '@/hooks/useOnline';
import { useI18n } from '@/i18n/I18nProvider';
import { foodName } from '@/i18n/translate';
import { colors, radius, spacing } from '@/theme/tokens';

type Option = { key: string; icon: IconName; title: string; hint: string; onPress: () => void };

/** Step 1 of adding a meal: choose how. */
export default function AddMethods() {
  const { t, language } = useI18n();
  const online = useOnline();
  const { draft, start, discard, newKey } = useDraft();
  const { foods } = useCatalog();

  const options: Option[] = [
    ...(process.env.EXPO_PUBLIC_VOICE_ENABLED === '1' ? [{key:'voice',icon:'mic' as const,title:t('text.voiceTitle'),hint:t('voice.hint'),onPress:()=>router.push('/add/voice')}] : []),
    {key:'text',icon:'edit-3',title:t('text.title'),hint:t('text.hint'),onPress:()=>router.push('/add/text')},
    {key:'recipes',icon:'book',title:t('recipes.title'),hint:t('recipes.create'),onPress:()=>router.push('/recipes')},
    {key: 'quick',icon:'list',title:t('library.title'),hint:t('library.hint'),onPress:()=>router.push('/library')},
    {
      key: 'camera',
      icon: 'camera',
      title: t('add.camera'),
      hint: t('add.cameraHint'),
      onPress: () => router.push({ pathname: '/add/photo', params: { source: 'camera' } }),
    },
    {
      key: 'library',
      icon: 'image',
      title: t('add.library'),
      hint: t('add.libraryHint'),
      onPress: () => router.push({ pathname: '/add/photo', params: { source: 'library' } }),
    },
    {
      key: 'barcode',
      icon: 'maximize',
      title: t('add.barcode'),
      hint: t('add.barcodeHint'),
      onPress: () => router.push('/add/barcode'),
    },
    {
      key: 'catalog',
      icon: 'list',
      title: t('add.catalog'),
      hint: foods ? t('add.catalogHint', { count: foods.length }) : t('catalog.estimateNote'),
      onPress: () => router.push('/add/catalog'),
    },
    {
      key: 'manual',
      icon: 'edit-2',
      title: t('add.manual'),
      hint: t('add.manualHint'),
      onPress: async () => {
        await start(manualDraft(newKey(), getAddIntent()));
        router.push('/add/review');
      },
    },
  ];

  const draftName = draft
    ? draft.foodId
      ? foodName(language, draft.foodId, draft.name)
      : draft.name.trim() || t('add.untitled')
    : '';

  return (
    <Screen header={<Header title={t('add.title')} leading="close" onLeading={() => router.dismissTo('/')} />}>
      {!online ? <Notice tone="warning" icon="wifi-off" title={t('states.offline')} message={t('states.needsConnection')} /> : null}
      {draft ? (
        <Notice tone="warning" icon="edit-3" title={t('add.resumeTitle')} message={t('add.resumeBody', { name: draftName })}>
          <Button label={t('add.resume')} onPress={() => router.push(resumeDraftPath(draft))} />
          <Button kind="ghost" label={t('add.discard')} onPress={discard} />
        </Notice>
      ) : null}
      <AppText variant="title" accessibilityRole="header">
        {t('add.question')}
      </AppText>
      <View style={styles.list}>
        {options.map((option) => (
          <Pressable
            key={option.key}
            testID={`method-${option.key}`}
            accessibilityRole="button"
            accessibilityLabel={option.title}
            accessibilityHint={option.hint}
            onPress={option.onPress}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
            <View style={styles.badge}>
              <Icon name={option.icon} color={colors.onSage} />
            </View>
            <View style={styles.text}>
              <AppText variant="bodyStrong">{option.title}</AppText>
              <AppText variant="caption" color={colors.muted}>
                {option.hint}
              </AppText>
            </View>
            <Icon name={directional.forward} color={colors.muted} size={20} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 76,
  },
  pressed: { backgroundColor: colors.field },
  badge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
});
