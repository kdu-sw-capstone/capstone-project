import schema from '../../contracts/additional-mvp/rc1/schema.json' with {type:'json'};
import {canonical} from '../a1/contract.mjs';
import {createWeeklyStartResolver} from './additional-schedule-plan.js';

const fail=()=>{throw Error('INVALID_SITE_TIME_WINDOW_INPUT');};
const exact=(v,keys)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// IANA backward-link names without a slash. Excludes ICU-only shortcuts such as
// CST/PST and numeric offset syntax; host ICU must also support the zone below.
const bareZones=new Set('CET CST6CDT Cuba EET EST EST5EDT Egypt Eire Factory GB GB-Eire GMT GMT+0 GMT-0 GMT0 Greenwich HST Hongkong Iceland Iran Israel Jamaica Japan Kwajalein Libya MET MST MST7MDT NZ NZ-CHAT Navajo PRC PST8PDT Poland Portugal ROC ROK Singapore Turkey UCT UTC Universal W-SU WET Zulu'.split(' '));
const keywords=new Set(['$ref','type','properties','required','additionalProperties','items','minItems','maxItems','uniqueItems','minimum','maximum','maxLength','pattern','format','const','enum','anyOf','oneOf']);
const instant=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value))fail();
 const n=Date.parse(value);if(!Number.isFinite(n)||new Date(n).toISOString()!==value||new Date(n).getUTCFullYear()<1)fail();return n;
};
function formatter(zone,cache){
 if(!cache.has(zone)){
  if(typeof zone!=='string'||!(bareZones.has(zone)||/^[A-Z][A-Za-z0-9_.+-]*(?:\/[A-Z][A-Za-z0-9_.+-]*)+$/.test(zone)))fail();
  try{
   const f=new Intl.DateTimeFormat('en-US-u-ca-iso8601-nu-latn',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',era:'short'}),native=f.resolvedOptions().timeZone;
   if(native.toLowerCase()===zone.toLowerCase()&&native!==zone)fail();
   cache.set(zone,f);
  }catch{fail();}
 }
 return cache.get(zone);
}
// Frozen SiteTimePolicy definitions only; unsupported schema semantics fail closed.
function matches(value,s,zones){
 if(!s||Object.keys(s).some(k=>!keywords.has(k)))return false;
 if(s.$ref)return matches(value,schema.$defs[s.$ref.split('/').at(-1)],zones);
 if(s.anyOf&&!s.anyOf.some(x=>matches(value,x,zones)))return false;
 if(s.oneOf&&s.oneOf.filter(x=>matches(value,x,zones)).length!==1)return false;
 // The approved const fields are scalar; do not canonicalize malformed objects.
 if(Object.hasOwn(s,'const')&&value!==s.const||s.enum&&!s.enum.includes(value))return false;
 if(s.type&&!['null','boolean','integer','string','array','object'].includes(s.type))return false;
 if(s.type==='null'&&value!==null)return false;
 if(s.type==='boolean'&&typeof value!=='boolean')return false;
 if(s.type==='integer'&&(!Number.isSafeInteger(value)||value<(s.minimum??-Infinity)||value>(s.maximum??Infinity)))return false;
 if(s.type==='string'){
  if(typeof value!=='string'||[...value].length>(s.maxLength??Infinity)||s.pattern&&!new RegExp(s.pattern).test(value))return false;
  if(s.format==='uuid'&&!UUID.test(value))return false;
  if(s.format==='date-time'){try{instant(value);}catch{return false;}}
  if(s.format==='iana-zone'){try{formatter(value,zones);}catch{return false;}}
  if(s.format&&!['uuid','date-time','iana-zone'].includes(s.format))return false;
 }
 if(s.type==='array'){
  if(!Array.isArray(value)||value.length<(s.minItems??0)||value.length>(s.maxItems??Infinity)||value.some(x=>!matches(x,s.items,zones)))return false;
  if(s.uniqueItems&&new Set(value.map(canonical)).size!==value.length)return false;
 }
 if(s.type==='object'){
  if(!value||typeof value!=='object'||Array.isArray(value)||s.required.some(k=>!Object.hasOwn(value,k)))return false;
  if(s.additionalProperties===false&&Object.keys(value).some(k=>!Object.hasOwn(s.properties,k)))return false;
  if(Object.entries(s.properties).some(([k,v])=>Object.hasOwn(value,k)&&!matches(value[k],v,zones)))return false;
 }
 return true;
}
const minute=value=>Number(value.slice(0,2))*60+Number(value.slice(3));
function shiftDate(date,offset){
 const d=new Date(date+'T00:00:00.000Z');d.setUTCDate(d.getUTCDate()+offset);
 if(d.getUTCFullYear()<1||d.getUTCFullYear()>9999)fail();return d.toISOString().slice(0,10);
}
function localDate(at,zone,zones){
 const p=Object.fromEntries(formatter(zone,zones).formatToParts(at).map(p=>[p.type,p.value]));
 if(p.era&&p.era!=='AD'||Number(p.year)<1||Number(p.year)>9999)fail();
 return String(p.year).padStart(4,'0')+'-'+p.month+'-'+p.day;
}
function validatePolicy(policy,zones){
 if(!matches(policy,schema.$defs.SiteTimePolicy,zones))fail();
 const ids=new Set();
 for(const w of policy.windows){
  if(ids.has(w.window_id))fail();ids.add(w.window_id);
  const t=w.when,duration=t.recurrence==='ONCE'?(instant(t.end_at)-instant(t.start_at))/60000:minute(t.end_local)-minute(t.start_local)+1440*t.end_day_offset;
  if(!(duration>0&&duration<=1440))fail();
 }
}
function membership(window,at,zones,resolved,resolveWeekly){
 const t=window.when;
 if(t.recurrence==='ONCE')return {matched:instant(t.start_at)<=at&&at<instant(t.end_at),skipped:[]};
 const date=localDate(at,t.timezone,zones),skipped=[];let matched=false;
 const resolve=(date,time)=>{
  const key=canonical([date,time,t.timezone]);
  if(!resolved.has(key))resolved.set(key,resolveWeekly({localDate:date,startLocal:time,timezone:t.timezone,weekdays:[1,2,3,4,5,6,7]}));
  return resolved.get(key);
 };
 // Tomorrow covers historical backward date-line folds. No arbitrary +/-1h shift.
 for(const startDate of [shiftDate(date,-1),date,shiftDate(date,1)]){
  const weekday=new Date(startDate+'T00:00:00.000Z').getUTCDay()||7;if(!t.weekdays.includes(weekday))continue;
  const start=resolve(startDate,t.start_local),end=resolve(shiftDate(startDate,t.end_day_offset),t.end_local);
  if(start.status==='SKIPPED'||end.status==='SKIPPED'){
   skipped.push({window_id:window.window_id,local_start_date:startDate,reason:'DST_GAP'});continue;
  }
  if(start.status!=='SCHEDULED'||end.status!=='SCHEDULED')fail();
  const a=instant(start.startAt),b=instant(end.startAt);if(!(b>a))fail();
  if(a<=at&&at<b)matched=true;
 }
 return {matched,skipped};
}

/** Pure projection for an ALREADY verified policy set and caller-supplied time.
 * Does not verify issued authority/clock/tzdb profile, compute quota, emit reports,
 * grant ALLOW, mutate claims, or apply/release DNR. No implicit Date.now().
 */
export function evaluateSiteTimeWindows(supplied){
 const input=structuredClone(supplied);
 if(!exact(input,['policies','host','nowAt'])||!matches(input.host,schema.$defs.Host,new Map())||!Array.isArray(input.policies)
  ||input.policies.length>schema.$defs.RuntimePackage.properties.runtime_policies.maxItems)fail();
 const at=instant(input.nowAt),zones=new Map(),resolved=new Map(),ids=new Set(),resolveWeekly=createWeeklyStartResolver();
 for(const policy of input.policies){validatePolicy(policy,zones);if(ids.has(policy.policy_id))fail();ids.add(policy.policy_id);}
 const policies=[];
 for(const policy of input.policies){
  if(!policy.enabled||!(input.host===policy.scope.host||policy.scope.include_subdomains&&input.host.endsWith('.'+policy.scope.host)))continue;
  const active=policy.windows.filter(w=>w.enabled),matched_window_ids=[],skipped_occurrences=[];
  for(const window of active){const result=membership(window,at,zones,resolved,resolveWeekly);if(result.matched)matched_window_ids.push(window.window_id);skipped_occurrences.push(...result.skipped);}
  const reasons=[];
  if(active.some(w=>w.kind==='BLOCK_WINDOW'&&matched_window_ids.includes(w.window_id)))reasons.push('BLOCK_WINDOW');
  const allow=active.filter(w=>w.kind==='ALLOW_WINDOW');
  if(allow.length&&!allow.some(w=>matched_window_ids.includes(w.window_id)))reasons.push('OUTSIDE_ALLOW_WINDOW');
  policies.push({policy_id:policy.policy_id,version:policy.version,reasons,matched_window_ids,skipped_occurrences,daily_limit_ms:policy.daily_limit_ms});
 }
 const reasons=['BLOCK_WINDOW','OUTSIDE_ALLOW_WINDOW'].filter(reason=>policies.some(p=>p.reasons.includes(reason)));
 return {local_only:true,evaluated_at:input.nowAt,decision:reasons.length?'WINDOW_BLOCK_REQUIRED':'NO_WINDOW_BLOCK',reasons,policies,
  requires_quota_evaluation:policies.some(p=>p.daily_limit_ms!==null)};
}
