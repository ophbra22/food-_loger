/** @jest-environment node */
import {createConnectPort} from '../android';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {configureHealthConnect}=require('../../../../plugins/with-health-connect.cjs');
test('default-off and absent native builds never request permissions or data',async()=>{
 const native={status:jest.fn(),authorize:jest.fn()};const port=createConnectPort(native as never,false);
 expect((await port.status()).available).toBe(false);await expect(port.authorize({nutrition:true,water:false,weight:false,steps:false})).rejects.toThrow();expect(native.authorize).not.toHaveBeenCalled();
 await expect(createConnectPort(null,true).manage!()).rejects.toThrow();
});
test('Android config requests only selected supported record capabilities, rationale and no background/history read',()=>{
 const manifest={application:[{$:{},'meta-data':[],'activity':[{$:{'android:name':'.MainActivity'}}]}]};
 const result=configureHealthConnect(manifest,true);const text=JSON.stringify(result);
 expect(result['uses-permission'].map((p:{$:Record<string,string>})=>p.$['android:name']).sort()).toEqual(['READ_STEPS','READ_WEIGHT','WRITE_HYDRATION','WRITE_NUTRITION'].map(p=>'android.permission.health.'+p));
 expect(text).toContain('HEALTH_PERMISSIONS');expect(text).toContain('SHOW_PERMISSIONS_RATIONALE');expect(text).not.toContain('READ_NUTRITION');expect(text).not.toContain('READ_HEALTH_DATA_IN_BACKGROUND');
 configureHealthConnect(manifest,true);expect(result['uses-permission']).toHaveLength(4);
 configureHealthConnect(manifest,false);expect(result['uses-permission']).toHaveLength(0);expect(result.application[0].activity).toHaveLength(1);
});
test('native page validation rejects unknown nutrition imports and wrong source identity',async()=>{
 const native={readPage:jest.fn(async()=>({events:[{operation:'upsert',kind:'calories',external_id:'12345678-1234-1234-1234-123456789012'}],nextCursor:'next',hasMore:false,recovered:false}))};
 await expect(createConnectPort(native as never,true).readPage!('s','a'.repeat(32),'weight',null,'from','to')).rejects.toThrow();
});
