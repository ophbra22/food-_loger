import {useSyncExternalStore} from 'react';
import {useAuth} from '@/auth/AuthProvider';
import {EMPTY_GOALS} from './goals-store';
const noop=()=>()=>{};
/** Shares the revision document with settings. useDay refreshes it with the daily read model. */
export function useGoals() {
 const {journal}=useAuth();
 return useSyncExternalStore(journal?.goals.subscribe??noop,journal?.goals.get??(()=>EMPTY_GOALS));
}
