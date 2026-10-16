import type {WidgetSnapshot} from './snapshot';
export type WidgetPort={available:()=>boolean;bind:(session:string)=>void;publish:(session:string,sequence:number,json:string)=>void;clear:()=>void};
/** Synchronous native gate avoids a queued disk write racing a later logout. */
export class WidgetPublisher {
 private sequence=0;private closed=false;
 constructor(private port:WidgetPort,private session:string){port.bind(session);}
 publish(snapshot:WidgetSnapshot){if(this.closed)return;this.port.publish(this.session,++this.sequence,JSON.stringify(snapshot));}
 close(){this.closed=true;this.port.clear();}
}
