import {useEffect,useRef,useState} from 'react';
import {CryptoDigestAlgorithm,digestStringAsync} from 'expo-crypto';
import {useAuth} from '@/auth/AuthProvider';
import {useI18n} from '@/i18n/I18nProvider';
import type {Draft} from '@/domain/drafts';
import type {PrivateProduct} from '@/domain/label-input';
import {reviewPayload} from '@/domain/unified-review';
import {Button} from './Button';import {Notice} from './Notice';
export function PrivateProductSave({draft,onSaved,disabled}:{draft:Draft;onSaved:(p:PrivateProduct)=>void;disabled:boolean}){
 const {api}=useAuth(),{t}=useI18n(),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[savedSignature,setSavedSignature]=useState<string|null>(null),[failed,setFailed]=useState(false),lock=useRef(false),live=useRef(true);
 const food=draft.analysis?.foods[0];
 const signature=JSON.stringify([food?.name,food?.manual,food?.amount,food?.basis,food?.reference,food?.confirmed]);
 useEffect(()=>{live.current=true;api.capabilities().then(c=>{if(live.current)setEnabled(c.private_products===true);}).catch(()=>{});const ref=live;return()=>{ref.current=false;};},[api]);
 const saved=savedSignature===signature;
 if(!enabled||!food||draft.analysis?.foods.length!==1)return null;
 const save=async()=>{if(lock.current||!food.confirmed)return;lock.current=true;setBusy(true);setFailed(false);const guard=api.captureSession();try{
  const item=reviewPayload(draft).items[0],source=food.originSource;
  const existing=source?.provider==='private_product',id=existing?source.reference_id!: (await digestStringAsync(CryptoDigestAlgorithm.SHA256,'private:'+draft.key+':'+food.id)).slice(0,32),version=existing?Number(source.version):0;
  const key=await digestStringAsync(CryptoDigestAlgorithm.SHA256,JSON.stringify({id,item,version}));guard();
  const result=await api.savePrivateProduct(id,item,version,key);guard();if(!live.current)return;onSaved(result);setSavedSignature(signature);
 }catch{if(live.current)setFailed(true);}finally{lock.current=false;if(live.current)setBusy(false);}};
 return <><Button label={t(saved?'label.savedPrivate':'label.savePrivate')} disabled={disabled||busy||saved||!food.confirmed} onPress={save}/>{failed?<Notice tone="error" message={t('label.failed')}/>:null}</>;
}
