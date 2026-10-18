// Separate Node process, real disk; only native storage adapters are replaced.
/* global __dirname */
const fs=require('node:fs'),path=require('node:path');
const {transformSync}=require('@babel/core');
const [directory,action]=process.argv.slice(2),cache=path.join(directory,'cache'),state=path.join(directory,'storage.json');
fs.mkdirSync(cache,{recursive:true});
const storage={
 setItem:async(key,value)=>{const data=fs.existsSync(state)?JSON.parse(fs.readFileSync(state,'utf8')):{};data[key]=value;fs.writeFileSync(state,JSON.stringify(data));},
 removeItem:async key=>{const data=fs.existsSync(state)?JSON.parse(fs.readFileSync(state,'utf8')):{};delete data[key];fs.writeFileSync(state,JSON.stringify(data));},
};
class File{constructor(name){this.name=name;}delete(){if(action==='fail')throw Error('locked');fs.unlinkSync(path.join(cache,this.name));}}
class Directory{}
const native={File,Directory,Paths:{cache:{list:()=>fs.readdirSync(cache).map(name=>new File(name))}}};
const modules={};
function load(name){
 if(name==='@react-native-async-storage/async-storage')return {__esModule:true,default:storage};
 if(name==='expo-file-system')return native;
 const mapped=name==='@/api/errors'?'api/errors':name.startsWith('./')?'storage/'+name.slice(2):name;
 if(modules[mapped])return modules[mapped].exports;
 const source=path.resolve(__dirname,'..',mapped+'.ts'),mod={exports:{}};modules[mapped]=mod;
 const {code}=transformSync(fs.readFileSync(source,'utf8'),{filename:source,babelrc:false,configFile:false,presets:[require.resolve('@babel/preset-typescript')],plugins:[require.resolve('@babel/plugin-transform-modules-commonjs')]});
 new Function('require','module','exports',code)(load,mod,mod.exports);return mod.exports;
}
(async()=>{
 const recovery=load('storage/private-cleanup-recovery');
 await recovery.recoverPrivateFiles();
 if(action==='crash'){
  fs.writeFileSync(path.join(cache,'biteflow-account-process.json'),'private');
  fs.writeFileSync(path.join(cache,'biteflow-2026-10-18.csv'),'private');
  fs.writeFileSync(path.join(cache,'unrelated.asset'),'keep');
  await storage.setItem('pending-draft','keep');await storage.setItem('native-receipts','keep');
  // Sudden exit: no cleanup callback, no session or marker carried in memory.
  process.exit(19);
 }
 process.stdout.write(JSON.stringify({failed:recovery.privateCleanupFailed(),files:fs.readdirSync(cache)}));
})().catch(()=>process.exit(20));
