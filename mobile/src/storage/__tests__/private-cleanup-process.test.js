/* global __dirname */
import {test,expect} from "@jest/globals";
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('a new OS process recovers JSON/CSV after abrupt exit, repeated failure, then signed-out retry',()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'biteflow-cleanup-'));
 const run=(action)=>spawnSync(process.execPath,[path.resolve(__dirname,'../../test-fixtures/cleanup-process.cjs'),directory,action],{encoding:'utf8',timeout:10000});
 try{
  expect(run('crash').status).toBe(19);
  expect(run('fail').status).toBe(20);
  expect(run('fail').status).toBe(20);
  const disk=JSON.parse(readFileSync(path.join(directory,'storage.json'),'utf8'));
  disk['foodlogger:private-cleanup-pending']='corrupt';writeFileSync(path.join(directory,'storage.json'),JSON.stringify(disk));
  const result=run('recover');expect(result.stderr).toBe('');expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({failed:false,files:['unrelated.asset']});
  expect(JSON.parse(readFileSync(path.join(directory,'storage.json'),'utf8'))).toEqual({'pending-draft':'keep','native-receipts':'keep'});
 }finally{rmSync(directory,{recursive:true,force:true});}
});
