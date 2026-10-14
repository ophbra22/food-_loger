import {SpeechSession,type SpeechBridge,type SpeechEvent,type SpeechState} from '../speech';
function fixture(){
 const listeners=new Map<string,(event:SpeechEvent)=>void>();const states:SpeechState[]=[],transcripts:string[]=[];
 let permission={granted:true,canAskAgain:true};let supported=true;let starts=0,aborts=0,stops=0;
 const bridge:SpeechBridge={permissions:async()=>permission,requestPermission:async()=>permission,available:async()=>supported,
  start:()=>{starts++;},stop:()=>{stops++;},abort:()=>{aborts++;},listen:(name,callback)=>{listeners.set(name,callback);return()=>{listeners.delete(name);};}};
 const session=new SpeechSession(bridge,s=>states.push(s),text=>transcripts.push(text));
 return {session,bridge,states,transcripts,listeners,counts:()=>({starts,aborts,stops}),permission:(value:typeof permission)=>{permission=value;},support:(value:boolean)=>{supported=value;},emit:(name:string,event:SpeechEvent={})=>listeners.get(name)?.(event)};
}
afterEach(()=>jest.useRealTimers());
it('never starts after denied permission and exposes a usable denial state',async()=>{
 const f=fixture();f.permission({granted:false,canAskAgain:false});await f.session.start('he-IL');
 expect(f.states.at(-1)).toBe('denied');expect(f.counts().starts).toBe(0);expect(f.listeners.size).toBe(0);
});
it('requires installed on-device language before requesting permission',async()=>{
 const f=fixture();f.support(false);f.bridge.requestPermission=async()=>{throw new Error('must not prompt');};
 await f.session.start('he-IL');expect(f.states.at(-1)).toBe('unavailable');expect(f.counts().starts).toBe(0);
});
it('stop retains final editable transcription; cancel ignores late results and removes listeners',async()=>{
 const f=fixture();await f.session.start('he-IL');f.emit('start');f.emit('result',{text:'אכלתי שתי ביצים',final:false});
 f.session.stop();expect(f.states.at(-1)).toBe('stopping');f.emit('result',{text:'אכלתי שתי ביצים וחצי פיתה',final:true});f.emit('end');
 expect(f.transcripts.at(-1)).toBe('אכלתי שתי ביצים וחצי פיתה');expect(f.states.at(-1)).toBe('idle');expect(f.listeners.size).toBe(0);
 await f.session.start('en-US');const late=f.listeners.get('result');f.session.cancel();late?.({text:'stale words'});
 expect(f.transcripts).not.toContain('stale words');expect(f.counts().aborts).toBeGreaterThan(0);
});
it('cancel during pending permission cannot start recording later',async()=>{
 const f=fixture();let resolve!:(value:{granted:boolean;canAskAgain:boolean})=>void;
 f.bridge.permissions=()=>new Promise(r=>{resolve=r;});const pending=f.session.start('en-US');
 await Promise.resolve();f.session.cancel();resolve({granted:true,canAskAgain:true});await pending;
 expect(f.counts().starts).toBe(0);expect(f.listeners.size).toBe(0);
});
it('rechecks revoked permission and cancels on background/interruption',async()=>{
 const f=fixture();await f.session.start('en-US');f.emit('start');f.session.appState('background');
 expect(f.states.at(-1)).toBe('idle');expect(f.listeners.size).toBe(0);
 f.permission({granted:false,canAskAgain:false});await f.session.start('en-US');expect(f.states.at(-1)).toBe('denied');
 f.permission({granted:true,canAskAgain:true});await f.session.start('en-US');f.emit('error',{error:'not-allowed'});
 expect(f.states.at(-1)).toBe('denied');expect(f.listeners.size).toBe(0);
});
it('bounds recording and the native stop wait; disposed sessions never reopen',async()=>{
 jest.useFakeTimers();const f=fixture();await f.session.start('en-US');f.emit('start');jest.advanceTimersByTime(60000);
 expect(f.counts().stops).toBe(1);jest.advanceTimersByTime(3000);expect(f.states.at(-1)).toBe('idle');
 f.session.dispose();await f.session.start('en-US');expect(f.counts().starts).toBe(1);expect(f.listeners.size).toBe(0);
});
it('permission or native errors return a recoverable error with no listeners',async()=>{
 const f=fixture();f.bridge.permissions=async()=>{throw new Error('native failure');};
 await f.session.start('en-US');expect(f.states.at(-1)).toBe('error');expect(f.listeners.size).toBe(0);
});
it('a synchronous native end on stop cannot leave a timer that cancels a new recording',async()=>{
 jest.useFakeTimers();const f=fixture();f.bridge.stop=()=>f.emit('end');await f.session.start('en-US');f.emit('start');
 f.session.stop();await f.session.start('he-IL');f.emit('start');jest.advanceTimersByTime(3000);
 expect(f.states.at(-1)).toBe('listening');f.session.dispose();
});
