import schema from './schema.json' with { type: 'json' };
export const VERSION='d06-shorts-a0-candidate-3';
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Complete validator for the vocabulary used by the frozen approval schema.
// No coercion, defaults, trimming, or unknown-field acceptance.
export function validateA0(value, definition=null) {
 const match=(v,s)=>{
  if(s.$ref)return match(v,schema.$defs[s.$ref.split('/').at(-1)]);
  if(s.oneOf)return s.oneOf.filter(x=>match(v,x)).length===1;
  if(Object.hasOwn(s,'const')&&v!==s.const)return false;
  if(s.enum&&!s.enum.includes(v))return false;
  if(s.type==='null'&&v!==null)return false;
  if(s.type==='boolean'&&typeof v!=='boolean')return false;
  if(s.type==='integer'&&(!Number.isSafeInteger(v)||v<(s.minimum??-Infinity)||v>(s.maximum??Infinity)))return false;
  if(s.type==='string'&&(typeof v!=='string'||[...v].length<(s.minLength??0)||[...v].length>(s.maxLength??Infinity)||s.pattern&&!new RegExp(s.pattern).test(v)))return false;
  if(s.type==='array'&&(!Array.isArray(v)||v.length<(s.minItems??0)||v.length>(s.maxItems??Infinity)||!v.every(x=>match(x,s.items))))return false;
  if(s.type==='object'||s.properties||s.required){
   if(!v||typeof v!=='object'||Array.isArray(v))return false;
   if(s.required?.some(k=>!Object.hasOwn(v,k)))return false;
   if(s.additionalProperties===false&&Object.keys(v).some(k=>!Object.hasOwn(s.properties,k)))return false;
   if(Object.entries(s.properties??{}).some(([k,t])=>Object.hasOwn(v,k)&&!match(v[k],t)))return false;
  }
  if(s.allOf&&!s.allOf.every(x=>!x.if||!match(v,x.if)||match(v,x.then)))return false;
  return true;
 };
 return match(value,definition?schema.$defs[definition]:schema);
}
export const canonical=v=>JSON.stringify(Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
export const fingerprint=m=>{const v=structuredClone(m);delete v.request_id;return canonical(v);};
export const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
export function workerSender(s,runtime){return !!s&&s.id===runtime.id&&s.url===runtime.getURL('background/service-worker.js')&&s.origin===runtime.getURL('').replace(/\/$/,'')&&!Object.hasOwn(s,'tab');}
export const error=(id,code,retryable=false)=>({request_id:id,status:'ERROR',data:null,error:{code,retryable}});
export const ok=(id,data)=>({request_id:id,status:'OK',data,error:null});
export function confirmedEffect(e){return e?.route_kind==='SHORTS'&&e.viewer_count>0&&e.media_count>0&&e.hidden_viewer_count===e.viewer_count&&e.inert_viewer_count===e.viewer_count&&e.paused_media_count===e.media_count&&e.observer_ready&&e.scan_completed_without_error&&e.error_count===0;}
export function confirmedRelease(e){return e&&['observer_stopped','timers_cleared','listeners_removed','notice_removed','owned_changes_restored'].every(k=>e[k]===true)&&e.remaining_owned_changes===0&&e.error_count===0;}
export class ChromeA0Store {
 constructor(storage,key){this.storage=storage;this.key=key;}
 async load(){return structuredClone((await this.storage.get(this.key))[this.key]??null);}
 async save(value){await this.storage.set({[this.key]:structuredClone(value)});}
}
