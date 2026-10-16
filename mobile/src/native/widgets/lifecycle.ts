import type {JournalStore} from '@/data/journal-store';
import {todayIso} from '@/domain/dates';
import {buildSnapshot,type WidgetSnapshot} from './snapshot';
import {WidgetPublisher,type WidgetPort} from './publisher';
export class WidgetLifecycle {
 private publisher:WidgetPublisher;private closed=false;private unsub:(()=>void)[]=[];private timer:ReturnType<typeof setTimeout>|null=null;private clock:ReturnType<typeof setInterval>|null=null;private day:string;private last:string|null=null;private lastUnavailable='';
 constructor(private journal:JournalStore,private port:WidgetPort,session:string,private language:'en'|'he',private now:()=>number=Date.now,private failed:()=>void=()=>{}){this.publisher=new WidgetPublisher(port,session);this.day=todayIso(new Date(now()));}
 private snapshot(withdraw=false){return buildSnapshot({day:withdraw?{data:null,savedAt:null,fresh:false,loading:false,error:null}:this.journal.get(this.day),goals:this.journal.goals.get(),water:this.journal.tracking.get('water',this.day),language:this.language,now:this.now()});}
 private send(snapshot:WidgetSnapshot){if(this.closed)return;const json=JSON.stringify(snapshot),unavailable=snapshot.state==='unavailable'?snapshot.date+snapshot.language:'';if(json===this.last||(unavailable&&unavailable===this.lastUnavailable))return;try{this.publisher.publish(snapshot);this.last=json;this.lastUnavailable=unavailable;}catch{this.failed();}}
 private schedule=()=>{if(this.closed)return;if(this.timer)clearTimeout(this.timer);this.timer=setTimeout(()=>{this.timer=null;this.send(this.snapshot());},100);};
 async start(){
  if(this.closed)return;
  this.unsub=[this.journal.subscribe(this.schedule),this.journal.goals.subscribe(this.schedule),this.journal.tracking.subscribe(this.schedule),this.journal.subscribeChanges(()=>{this.send(this.snapshot(true));void this.refresh();})];
  this.clock=setInterval(()=>{const next=todayIso(new Date(this.now()));if(next!==this.day){this.day=next;this.send(this.snapshot(true));void this.refresh();}else this.send(this.snapshot());},30000);
  await this.refresh();
 }
 async refresh(){if(this.closed)return;const next=todayIso(new Date(this.now()));if(next!==this.day){this.day=next;this.send(this.snapshot(true));}await Promise.all([this.journal.refresh(this.day),this.journal.tracking.load('water',this.day)]);if(!this.closed)this.send(this.snapshot());}
 close(){if(this.closed)return;this.closed=true;if(this.timer)clearTimeout(this.timer);if(this.clock)clearInterval(this.clock);this.unsub.forEach(f=>f());this.publisher.close();}
}
