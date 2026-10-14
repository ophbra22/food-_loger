import { validateGoalDocument, type GoalDocument } from '@/domain/goals';
import { accountKey, readJson, writeJson, remove } from './kv';
export const goalsCache={
 async read(owner:string):Promise<{data:GoalDocument;savedAt:number}|null> {
  const v=await readJson<{owner:string;schema:number;data:unknown;savedAt:number}>(accountKey(owner,'goals:v1'));
  if(!v || v.owner!==owner || v.schema!==1 || !Number.isFinite(v.savedAt))return null;
  try{return {data:validateGoalDocument(v.data),savedAt:v.savedAt};}catch{return null;}
 },
 write:(owner:string,data:GoalDocument,savedAt:number)=>writeJson(accountKey(owner,'goals:v1'),{owner,schema:1,data,savedAt}),
 remove:(owner:string)=>remove(accountKey(owner,'goals:v1')),
};
