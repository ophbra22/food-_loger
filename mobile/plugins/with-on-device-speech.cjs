/** Pinned, fail-closed privacy guard until upstream enforces per-locale on-device requests. */
const {withDangerousMod,withAndroidManifest}=require('expo/config-plugins');
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const patches=require('./speech-guard.json');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function patchSpeech(root){
 if(JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version!=='57.1.1')throw new Error('Review the speech dependency before upgrading.');
 // Validate all files before writing any; repeated prebuilds are idempotent.
 const changes=patches.map(p=>{
  const file=path.join(root,p.filename),source=fs.readFileSync(file,'utf8');
  if(hash(source)===p.patched)return null;
  if(hash(source)!==p.original)throw new Error('Review unexpected speech native source changes.');
  let next=source;for(const [before,after] of p.replacements)next=next.replace(before,after);
  if(hash(next)!==p.patched)throw new Error('Review failed speech patch.');
  return {file,next};
 });
 changes.filter(Boolean).forEach(({file,next})=>fs.writeFileSync(file,next));
}
module.exports=(config,{enabled=false}={})=>{
 config=withAndroidManifest(config,mod=>{
  const manifest=mod.modResults.manifest;
  manifest['uses-permission']=(manifest['uses-permission']??[]).filter(p=>p.$['android:name']!=='android.permission.RECORD_AUDIO');
  manifest['uses-permission'].push({$:{'android:name':'android.permission.RECORD_AUDIO',...(!enabled?{'tools:node':'remove'}:{})}});
  return mod;
 });
 return withDangerousMod(config,['ios',async mod=>{
 if(!mod.modRequest.introspect)patchSpeech(path.dirname(require.resolve('expo-speech-recognition/package.json',{paths:[mod.modRequest.projectRoot]})));
 return mod;
}]);
};
module.exports.patchSpeech=patchSpeech;
