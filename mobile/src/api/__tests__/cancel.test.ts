import { createApiClient } from '../client';
test('caller cancellation aborts transport and reports cancellation distinctly', async()=>{
 const controller=new AbortController();
 const client=createApiClient({baseUrl:()=> 'http://127.0.0.1',token:()=> 'local',onSessionRejected:jest.fn(),
   fetch:jest.fn((_url,options)=>new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new Error('abort'))))) as typeof fetch});
 const pending=client.request('/api/analyze-meal',{signal:controller.signal});
 controller.abort();
 await expect(pending).rejects.toMatchObject({kind:'cancelled'});
});
