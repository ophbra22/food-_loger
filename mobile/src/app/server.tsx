import { Redirect } from 'expo-router';

import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { ServerSettings } from '@/components/ServerSettings';
import { ALLOW_SERVER_OVERRIDE } from '@/config/env';
import { useI18n } from '@/i18n/I18nProvider';

/** Reachable from the sign-in screen in test builds, so a wrong address never locks a tester out. */
export default function ServerScreen() {
  const { t } = useI18n();
  if (!ALLOW_SERVER_OVERRIDE) return <Redirect href="/sign-in" />;
  return (
    <Screen header={<Header title={t('settings.server')} />}>
      <ServerSettings />
    </Screen>
  );
}
