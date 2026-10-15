import type {HealthSync} from './sync';
let current:HealthSync|null=null;
export function setHealthSession(value:HealthSync|null){current?.close();current=value;}
export function stopHealthSession(){setHealthSession(null);}
