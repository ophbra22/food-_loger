import {ApiError} from '@/api/errors';
let generation=0,authorized=false;
export function allowPrivateExports(){authorized=true;}
export function stopPrivateExports(){authorized=false;generation++;}
export function capturePrivateExport(){
 const current=generation;
 return ()=>{if(!authorized||current!==generation)throw new ApiError('unauthorized');};
}
