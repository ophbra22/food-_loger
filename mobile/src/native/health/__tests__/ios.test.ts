import {createHealthPort} from '../ios';
const choices={nutrition:true,water:false,weight:false,steps:false};
test('missing or disabled native capability never requests authorization',async()=>{const authorize=jest.fn();for(const native of [null,{authorize}]){const p=createHealthPort(native as never,false);expect((await p.status()).available).toBe(false);await expect(p.authorize(choices)).rejects.toThrow();}expect(authorize).not.toHaveBeenCalled();});
test('dialog completion is not claimed as read permission',async()=>{const p=createHealthPort({status:async()=>({available:true,read:'unknown',write:{calories:'denied'}}),authorize:async()=>{}} as never,true);await p.authorize(choices);expect(await p.status()).toMatchObject({read:'unknown',write:{calories:'denied'}});});
