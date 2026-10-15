import {useAuth} from '@/auth/AuthProvider';
import {TrackingPanel} from './TrackingPanel';
export function WaterToday({day,target}:{day:string;target:number|null}){
 const {journal}=useAuth();return journal?.tracking?<TrackingPanel key={journal.userId+':'+day} kind="water" day={day} store={journal.tracking} target={target} compact/>:null;
}
