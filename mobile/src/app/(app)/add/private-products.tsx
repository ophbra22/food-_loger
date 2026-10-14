import {useEffect,useRef,useState} from 'react';
import {Alert} from 'react-native';
import {router} from 'expo-router';
import {useAuth} from '@/auth/AuthProvider';import {useDraft} from '@/data/DraftProvider';import {getAddIntent} from '@/data/add-intent';
import {privateProductDraft,type PrivateProduct} from '@/domain/label-input';import {useI18n} from '@/i18n/I18nProvider';
import {Screen} from '@/components/Screen';import {Header} from '@/components/Header';import {Button} from '@/components/Button';import {TextField} from '@/components/TextField';import {Notice} from '@/components/Notice';
export default function PrivateProductsScreen(){const {user}=useAuth();return <Products key={user?.id}/>;}
function Products(){
 const {api}=useAuth(),{start,newKey}=useDraft(),{t}=useI18n();const [items,setItems]=useState<PrivateProduct[]>([]),[query,setQuery]=useState(''),[failed,setFailed]=useState(false),[busy,setBusy]=useState(false),generation=useRef(0);
 useEffect(()=>{const n=++generation.current;api.privateProducts().then(r=>{if(n===generation.current)setItems(r.products);}).catch(()=>{if(n===generation.current)setFailed(true);});const g=generation;return()=>{g.current++;};},[api]);
 const choose=async(p:PrivateProduct)=>{if(busy)return;setBusy(true);const guard=api.captureSession();try{guard();await start(privateProductDraft(p,newKey(),getAddIntent()));guard();router.replace('/add/review');}catch{setFailed(true);}finally{setBusy(false);}};
 const remove=async(p:PrivateProduct)=>{setBusy(true);const guard=api.captureSession();try{await api.deletePrivateProduct(p.id,p.version);guard();setItems(rows=>rows.filter(r=>r.id!==p.id));}catch{setFailed(true);}finally{setBusy(false);}};
 return <Screen header={<Header title={t('label.private')}/>}><Notice message={t('label.privateHint')}/><TextField label={t('analysis.search')} value={query} maxLength={120} onChangeText={setQuery}/>
  {items.filter(p=>p.item.display_name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(p=><ProductRow key={p.id} product={p} choose={()=>choose(p)} remove={()=>Alert.alert(t('label.deletePrivate'),p.item.display_name,[{text:t('common.cancel'),style:'cancel'},{text:t('label.deletePrivate'),style:'destructive',onPress:()=>remove(p)}])} disabled={busy}/>)}
  {failed?<Notice tone="error" message={t('label.failed')}/>:null}
 </Screen>;
}
function ProductRow({product,choose,remove,disabled}:{product:PrivateProduct;choose:()=>void;remove:()=>void;disabled:boolean}){const {t}=useI18n();return <><Button label={`${product.item.display_name} · v${product.version}`} onPress={choose} disabled={disabled}/><Button kind="ghost" label={t('label.deletePrivate')} onPress={remove} disabled={disabled}/></>;}
