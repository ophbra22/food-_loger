import {useDraft} from '@/data/DraftProvider';
import {errorMessageKey} from '@/api/messages';
import {useI18n} from '@/i18n/I18nProvider';
import {Notice} from './Notice';
import {Button} from './Button';

export function DraftPersistenceNotice() {
  const {persistenceError,discard,saving}=useDraft();const {t}=useI18n();
  if(!persistenceError)return null;
  return <Notice tone="error" message={t(errorMessageKey(persistenceError))}>
    {persistenceError.kind==='draftFormat'?<Button kind="danger" label={t('review.discard')}
      disabled={saving} onPress={()=>{void discard();}}/>:null}
  </Notice>;
}
