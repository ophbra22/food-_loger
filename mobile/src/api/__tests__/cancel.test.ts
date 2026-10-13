import { createApiClient } from '../client';
test('caller cancellation aborts transport and reports cancellation distinctly', async()=>{
 const controller=new AbortController();
 const client=createApiClient({baseUrl:()=> 'http://127.0.0.1',token:()=> 'local',onSessionRejected:jest.fn(),
   fetch:jest.fn((_url,options)=>new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new Error('abort'))))) as typeof fetch});
 const pending=client.request('/api/analyze-meal',{signal:controller.signal});
 controller.abort();
 await expect(pending).rejects.toMatchObject({kind:'cancelled'});
});

test.each(['cancel','timeout'])('stalled body stays cancellable: %s',async(mode)=>{
 jest.useFakeTimers();
 const controller=new AbortController();let wire:AbortSignal|undefined;
 const client=createApiClient({baseUrl:()=> 'http://127.0.0.1',token:()=> 'local',onSessionRejected:jest.fn(),
  fetch:(async(_url,options)=>{
   wire=options?.signal as AbortSignal;
   return {ok:true,status:200,json:()=>new Promise((_resolve,reject)=>wire!.addEventListener('abort',()=>reject(new Error('aborted'))))} as Response;
  }) as typeof fetch});
 const pending=client.request('/slow-body',{signal:controller.signal,timeoutMs:10});
 await Promise.resolve();
 const result=expect(pending).rejects.toMatchObject({kind:mode==='cancel'?'cancelled':'timeout'});
 if(mode==='cancel')controller.abort();else jest.advanceTimersByTime(11);
 expect(wire?.aborted).toBe(true);
 await result;
 jest.useRealTimers();
});
