import schema from './schema.json' with {type:'json'};
export const VERSION='d06-guest-a1-candidate-2';
export const canonical=v=>JSON.stringify(Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
const utc=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(Date.parse(v)).toISOString().slice(0,19)===v.slice(0,19);
export function valid(value,definition){
 if(definition==='aggregate'){if(value?.document_transition_contract==='ND01_1'&&value.native_transition_contract!=='NR01_1')return false;if(value?.native_transition?.transition_kind&&(value.document_transition_contract!=='ND01_1'||!value.native_transition.document_set))return false;if(value?.native_transition?.document_set&&!value.native_transition.transition_kind)return false;const d=value?.effect_transition;if(value?.dom_transition_contract==='DP01_1'&&value.native_transition_contract!=='NR01_1')return false;if(value?.session_status==='EFFECT_VERIFYING'&&(value.dom_transition_contract!=='DP01_1'||!d||!['VERIFYING','READY'].includes(d.phase)))return false;if(d&&(value.dom_transition_contract!=='DP01_1'||d.deadline_at<=d.started_at||d.deadline_at-d.started_at>3000||new TextEncoder().encode(JSON.stringify(d)).length>8192))return false;const n=value?.native_transition;if(value?.session_status==='NATIVE_VERIFYING'&&(!n||value.native_transition_contract!=='NR01_1'||['CONFIRMED','FAILED'].includes(n.phase)))return false;if(n&&(value.native_transition_contract!=='NR01_1'||new TextEncoder().encode(JSON.stringify(n)).length>8192||n.deadline_at<=n.started_at||n.deadline_at-n.started_at>5000))return false;}

 const match=(v,s)=>{
  if(s===true)return true;if(s===false)return false;
  if(s.$ref)return match(v,schema.$defs[s.$ref.split('/').at(-1)]);
  if(s.oneOf&&s.oneOf.filter(x=>match(v,x)).length!==1)return false;
  if(s.anyOf&&!s.anyOf.some(x=>match(v,x)))return false;
  if(s.not&&match(v,s.not))return false;
  if(s.allOf&&!s.allOf.every(x=>match(v,x)))return false;
  if(s.if){const branch=match(v,s.if)?s.then:s.else;if(branch&&!match(v,branch))return false;}
  if(Object.hasOwn(s,'const')&&canonical(v)!==canonical(s.const)||s.enum&&!s.enum.some(x=>canonical(x)===canonical(v)))return false;
  if(s.type==='null'&&v!==null||s.type==='boolean'&&typeof v!=='boolean')return false;
  if(s.type==='integer'&&(!Number.isSafeInteger(v)||v<(s.minimum??-Infinity)||v>(s.maximum??Infinity)))return false;
  if(s.type==='string'){
   if(typeof v!=='string'||[...v].length<(s.minLength??0)||[...v].length>(s.maxLength??Infinity)||s.pattern&&!new RegExp(s.pattern).test(v))return false;
   if(s.format==='a1-utc-instant'&&!utc(v))return false;
   if(s.format&&s.format!=='a1-utc-instant')return false;
  }
  if(s.type==='array'){
   if(!Array.isArray(v)||v.length<(s.minItems??0)||v.length>(s.maxItems??Infinity)||s.items&&!v.every(x=>match(x,s.items)))return false;
   if(s.uniqueItems&&new Set(v.map(canonical)).size!==v.length)return false;
  }
  if(s.type==='object'||s.properties||s.required){
   if(v===null||typeof v!=='object'||Array.isArray(v)||s.required?.some(k=>!Object.hasOwn(v,k)))return false;
   if(s.additionalProperties===false&&Object.keys(v).some(k=>!Object.hasOwn(s.properties??{},k)))return false;
   if(Object.entries(s.properties??{}).some(([k,t])=>Object.hasOwn(v,k)&&!match(v[k],t)))return false;
   if(s.additionalProperties&&typeof s.additionalProperties==='object'&&Object.keys(v).some(k=>!Object.hasOwn(s.properties??{},k)&&!match(v[k],s.additionalProperties)))return false;
  }
  return true;
 };
 return !!(!definition||schema.$defs[definition])&&match(value,definition?schema.$defs[definition]:schema);
}
export const same=(a,b)=>canonical(a)===canonical(b);
export async function digest(v){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(v))))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export const fail=code=>{throw Error(code);};
export function preflight(snapshot,hostPolicy,{isolatedTrial=false,limitedProduct11=false,newlyGenerated=false}={}){
 if(!valid(snapshot,'guest_snapshot'))fail('INVALID_SNAPSHOT');
 hostPolicy.validateSnapshot(snapshot,false);
 if(snapshot.owner_user_id!==null)fail('OWNER_MISMATCH');
 if(newlyGenerated&&(!(isolatedTrial||limitedProduct11)||snapshot.format_version!=='1.1'))fail('SNAPSHOT_ISSUANCE_OFF');
 if(Object.values(snapshot.content_policy).some(x=>x&&typeof x==='object'&&x.enabled))fail('FEATURE_NOT_IMPLEMENTED');
 const shorts=snapshot.sites.some(x=>x.feature_policies.some(f=>f.enabled));
 // U06 approved: Core arbitrates RECORD vs confirmed FEATURE; failures never fall back to RECORD.
 return snapshot;
}
export async function makeGuestSnapshot({owner,sites,sourceVersion,createdAt,contentPolicy,isolatedTrial=false,limitedProduct11=false},hostPolicy){
 const s={policy_snapshot_id:crypto.randomUUID(),format_version:'1.1',owner_user_id:null,executor_id:owner.installation_id,created_at:createdAt,source_version:sourceVersion,sites:structuredClone(sites),content_policy:contentPolicy===undefined?hostPolicy.defaultContent():structuredClone(contentPolicy)};
 preflight(s,hostPolicy,{isolatedTrial,limitedProduct11,newlyGenerated:true});return s;
}
export const makeTrialSnapshot=(input,hostPolicy)=>makeGuestSnapshot({...input,isolatedTrial:true},hostPolicy);
export const ref=async s=>({policy_snapshot_id:s.policy_snapshot_id,snapshot_format:s.format_version,snapshot_sha256:await digest(s),source_version:s.source_version});
export const B5_PROFILE=Object.freeze({id:'FOCURVE_B5_1',max_documents:5,total_operations:160,total_writes:320,per_binding_operations:32,per_binding_writes:64});
export function trialReservations(bindings,profile=null){
 if(profile!==null&&!same(profile,B5_PROFILE))fail('INVALID_CLEANUP_RESERVATION');
 const maxOperations=profile?160:128,maxWrites=profile?320:256;
 let operations=0,writes=0;
 for(const b of bindings){
  if(!valid(b,'binding'))fail('INVALID_A1_RECORD');
  const r=b.cleanup_reservation;
  if(r.reserved_operations!==32||r.reserved_writes!==64||r.remaining_operations>32||r.remaining_writes>64)fail('INVALID_CLEANUP_RESERVATION');
  // Resolution, not tab visibility, controls reservation release.
  if(b.resolution==='NONE'||b.cleanup_pending){operations+=32;writes+=64;}
 }
 if(operations>maxOperations||writes>maxWrites)fail('CLEANUP_CAPACITY');
 return {operations,writes,available_operations:maxOperations-operations,available_writes:maxWrites-writes};
}
export function effectConfirmed(e){return valid(e,'effect')&&e.route_kind==='SHORTS'&&e.viewer_count>0&&e.media_count>0&&e.hidden_viewer_count===e.viewer_count&&e.inert_viewer_count===e.viewer_count&&e.paused_media_count===e.media_count&&e.observer_ready&&e.scan_completed_without_error&&e.error_count===0;}
export function releaseConfirmed(e){return valid(e,'release_evidence')&&e.observer_stopped&&e.timers_cleared&&e.listeners_removed&&e.notice_removed&&e.owned_changes_restored&&e.remaining_owned_changes===0&&e.error_count===0;}
export function workerSender(s,runtime){return !!s&&s.id===runtime.id&&s.url===runtime.getURL('background/service-worker.js')&&s.origin===runtime.getURL('').replace(/\/$/,'')&&!Object.hasOwn(s,'tab');}
