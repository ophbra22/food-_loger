const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {patchSpeech}=require('../with-on-device-speech.cjs');
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'biteflow-speech-'));const source=path.dirname(require.resolve('expo-speech-recognition/package.json'));fs.cpSync(source,root,{recursive:true});return root;}
test('patches the pinned dependency idempotently and rejects an unreviewed version without writes',()=>{
 const root=fixture();try{
  const original=fs.readFileSync(path.join(root,'ios/ExpoSpeechRecognizer.swift'),'utf8');
  patchSpeech(root);const safe=fs.readFileSync(path.join(root,'ios/ExpoSpeechRecognizer.swift'),'utf8');assert.ok(safe.length>=original.length);
  patchSpeech(root);assert.equal(fs.readFileSync(path.join(root,'ios/ExpoSpeechRecognizer.swift'),'utf8'),safe);
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'58.0.0'}));
  assert.throws(()=>patchSpeech(root),/review/i);assert.equal(fs.readFileSync(path.join(root,'ios/ExpoSpeechRecognizer.swift'),'utf8'),safe);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('unknown native source fails closed before any source file is written',()=>{
 const root=fixture();try{const moduleFile=path.join(root,'ios/ExpoSpeechRecognitionModule.swift');fs.appendFileSync(moduleFile,'\n// unexpected drift\n');
 const before=fs.readFileSync(path.join(root,'ios/ExpoSpeechRecognizer.swift'),'utf8');assert.throws(()=>patchSpeech(root),/review/i);assert.equal(fs.readFileSync(path.join(root,'ios/ExpoSpeechRecognizer.swift'),'utf8'),before);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
