import {useEffect,useRef,useState} from 'react';
import {CryptoDigestAlgorithm,digestStringAsync} from 'expo-crypto';
import {isApiError} from '@/api/errors';
import {useAuth} from '@/auth/AuthProvider';
import {useI18n} from '@/i18n/I18nProvider';
import type {Draft} from '@/domain/drafts';
import type {PrivateProduct} from '@/domain/label-input';
import {reviewPayload} from '@/domain/unified-review';
import {Button} from './Button';import {Notice} from './Notice';
export function PrivateProductSave({draft,onSaved,disabled,onBusyChange}:{draft:Draft;onSaved:(p:PrivateProduct)=>void;disabled:boolean;onBusyChange?:(busy:boolean)=>void}){
 const {api}=useAuth(),{t}=useI18n(),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[savedSignature,setSavedSignature]=useState<string|null>(null),[failed,setFailed]=useState<'limit'|'unknown'|null>(null),lock=useRef(false),live=useRef(true);
 const food=draft.analysis?.foods[0];
 const signature=JSON.stringify([food?.name,food?.manual,food?.amount,food?.basis,food?.reference,food?.confirmed]);
 useEffect(()=>{live.current=true;api.capabilities().then(c=>{if(live.current)setEnabled(c.private_products===true);}).catch(()=>{});const ref=live;return()=>{ref.current=false;};},[api]);
 const saved=savedSignature===signature;
 if(!enabled||!food||draft.analysis?.foods.length!==1)return null;
 const save=async()=>{if(disabled||lock.current||!food.confirmed)return;lock.current=true;setBusy(true);onBusyChange?.(true);setFailed(null);const guard=api.captureSession();try{
  const item=reviewPayload(draft).items[0],source=food.originSource;
  const existing=source?.provider==='private_product',id=existing?source.reference_id!: (await digestStringAsync(CryptoDigestAlgorithm.SHA256,'private:'+draft.key+':'+food.id)).slice(0,32),version=existing?Number(source.version):0;
  const key=await digestStringAsync(CryptoDigestAlgorithm.SHA256,JSON.stringify({id,item,version}));guard();
  const result=await api.savePrivateProduct(id,item,version,key);guard();if(!live.current)return;onSaved(result);setSavedSignature(signature);
 }catch(error){if(live.current)setFailed(isApiError(error)&&error.kind==='validation'&&error.detail==='Private product limit reached; remove an unused product first.'?'limit':'unknown');}finally{lock.current=false;if(live.current){setBusy(false);onBusyChange?.(false);}}};
 return <><Notice message={t('label.privateLimit')}/><Button label={t(saved?'label.savedPrivate':'label.savePrivate')} disabled={disabled||busy||saved||!food.confirmed} onPress={save}/>{failed?<Notice tone="error" message={t(failed==='limit'?'label.privateFull':'label.privateFailed')}/>:null}</>;
}
