import {VERSION,valid,same,digest,effectConfirmed,releaseConfirmed,workerSender,fail} from './contract.mjs';
import {error,instant,coverageConfirmed} from './domain.mjs';
import {respondProbe} from './p1.mjs';
import {A1Client} from './client.mjs';
import {A0ShortsEffect} from '../a0/shorts-effect.mjs';
import {featureEntry} from '../content/entry.mjs';
export class A1Content {
 constructor(config,runtime,document,{client=new A1Client(runtime,config),effect=new A0ShortsEffect(document,{preserveOnFailure:true})}={}){
  if(!valid(config,'bootstrap'))fail('INVALID_SCHEMA');this.config=structuredClone(config);this.runtime=runtime;this.document=document;this.client=client;this.effect=effect;this.tail=Promise.resolve();this.inactive=false;this.disposed=false;this.registered=false;this.lastApply=null;this.pending=0;this.fingerprints=new Map();
 }
 // GENERAL coverage must measure the GENERAL ShortsControl.apply target set.
 // YouTube retains its old ytd-shorts subtree after leaving the viewer. The
 // SHORTS outcome separately verifies viewers/media when the route is Shorts.
 coverage(){try{const elements=[...new Set([...this.document.querySelectorAll('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts]'),...[...this.document.querySelectorAll('a[href]')].filter(a=>featureEntry(a.href)==='YOUTUBE_SHORTS')])];return {route_kind:'GENERAL',candidate_count:elements.length,hidden_candidate_count:elements.filter(x=>this.document.defaultView.getComputedStyle(x).display==='none').length,inert_candidate_count:elements.filter(x=>x.inert===true).length,observer_ready:this.effect.running===true&&!!this.effect.observer,scan_completed_without_error:!this.effect.scanning&&!this.effect.queuedScans,error_count:this.effect.errors??0};}catch{return {route_kind:'GENERAL',candidate_count:0,hidden_candidate_count:0,inert_candidate_count:0,observer_ready:false,scan_completed_without_error:false,error_count:1};}}
 outcome(){const effect=this.effect.evidence();if(effect.route_kind==='SHORTS')return {result_state:effectConfirmed(effect)?'APPLIED':'UNCONFIRMED',effect_evidence:effect,coverage_evidence:null};const coverage=this.coverage();return {result_state:coverageConfirmed(coverage)?coverage.candidate_count?'COVERED':'NOT_APPLICABLE':'UNCONFIRMED',effect_evidence:null,coverage_evidence:coverage};}
 scope(m){const p=m.payload,c=this.config;if(!same(p.scope,c.scope)||m.owner_context!==c.scope.owner_context)fail('SCOPE_MISMATCH');if(p.operation==='APPLY'&&(!same(p.projection,c.projection)||p.cleanup_authorization_id!==c.cleanup_authorization_id||p.rule_id!==c.rule_id))fail('SCOPE_MISMATCH');if(p.operation==='RELEASE'&&(p.applied_binding_id!==c.scope.binding_id||p.cleanup_authorization_id!==c.cleanup_authorization_id))fail('SCOPE_MISMATCH');if(this.inactive&&p.operation!=='RELEASE'&&p.query_mode!=='RECOVERY_DIAGNOSTIC')fail('INACTIVE_SCOPE');}
 async handle(m,s){if(!valid(m,'control_request'))return error(m?.request_id??crypto.randomUUID(),'INVALID_SCHEMA');if(!workerSender(s,this.runtime))return error(m.request_id,'UNAUTHORIZED_SENDER');
  const cleanup=m.payload.operation==='RELEASE';if(this.pending>=(cleanup?40:32))return error(m.request_id,'STORE_CAPACITY');this.pending++;
  const work=this.tail.then(()=>this.perform(m));this.tail=work.catch(()=>{});try{return await work;}catch(e){return error(m.request_id,e.message);}finally{this.pending--;}
 }
 async perform(m){this.scope(m);const p=m.payload,original=structuredClone(m);delete original.request_id;const fp=await digest(original),old=this.fingerprints.get(p.operation_id);if(old&&old!==fp)return error(m.request_id,'OPERATION_CONFLICT');if(!old&&this.fingerprints.size>=288)return error(m.request_id,'STORE_CAPACITY');this.fingerprints.set(p.operation_id,fp);
  if(old){let stored;try{stored=await this.client.read('OPERATION',p.operation_id);}catch(e){if(e.message!=='STORE_UNCONFIRMED')throw e;}
   if(stored?.phase==='RESULT_EVICTED')return error(m.request_id,'OPERATION_RESULT_EVICTED');if(stored?.first_response)return {...structuredClone(stored.first_response),request_id:m.request_id};if(['IN_FLIGHT','IN_DOUBT'].includes(stored?.phase))return error(m.request_id,'STORE_UNCONFIRMED');
   // No result does not authorize effects. BEGIN below must atomically prove
   // the original operation is still ISSUED; IN_FLIGHT/IN_DOUBT cannot restart.
  }
  const summary=await this.client.read();
  try{await this.client.commit({kind:'BEGIN_OPERATION',operation_id:p.operation_id});}catch(e){if(e.message!=='OPERATION_CONFLICT')throw e;const stored=await this.client.read('OPERATION',p.operation_id);if(stored.phase==='RESULT_EVICTED')return error(m.request_id,'OPERATION_RESULT_EVICTED');if(stored.first_response)return {...structuredClone(stored.first_response),request_id:m.request_id};return error(m.request_id,'STORE_UNCONFIRMED');}
  const data={protocol_version:VERSION,family:'CONTROL',operation_id:p.operation_id,operation:p.operation,scope:structuredClone(this.config.scope),result_state:'ADAPTER_READY',effect_evidence:null,coverage_evidence:null,release_evidence:null,observed_at:instant()};
  let response;
  try{
   if(p.operation==='QUERY'){
    // A QUERY must not freeze a provisional scan result while its durable
    // ledger/DOM work is still in flight. No effect is authorized here; the
    // original BEGIN, native guards and Root dispatch deadline remain.
    for(let pending;this.effect.running&&(pending=this.effect.pending);){await pending;if(pending===this.effect.pending)break;}
    if(this.effect.running)Object.assign(data,this.outcome());else if(this.registered)data.result_state='UNCONFIRMED';
   }else if(p.operation==='APPLY'){
    if(this.registered||this.inactive)fail('CLEANUP_REQUIRED');this.registered=true;this.lastApply=p;
    let confirmedLedger=null;const result=await this.effect.start(async ledger=>{
     if(confirmedLedger!==null&&same(ledger,confirmedLedger))return;const view=await this.client.commit({kind:'LEDGER_PLAN',operation_id:p.operation_id,entries:ledger});if(view.dom_cap&&(view.dom_cap.plan_hash!==await digest(ledger)||Date.now()>=view.dom_cap.deadline_at))fail('UNAUTHORIZED_SENDER');confirmedLedger=structuredClone(ledger);
     // Query evidence is fresh; the observer never produces Feature access Events.
    });Object.assign(data,this.outcome());if(result.result_state==='TIMED_OUT')data.result_state='TIMED_OUT';if(result.result_state==='APPLY_FAILED')data.result_state='FAILED';
   }else{
    this.inactive=true;this.document.defaultView.clearInterval(this.heartbeat);this.heartbeat=null;const e=await this.effect.release();data.release_evidence=e;data.result_state=releaseConfirmed(e)?'RELEASED':'RELEASE_FAILED';
   }
   data.observed_at=instant();response={request_id:m.request_id,status:'OK',data,error:null};if(!valid(response,'control_ok'))fail('INVALID_CURRENT_RESPONSE');
  }catch(e){this.inactive=true;this.document.defaultView.clearInterval(this.heartbeat);this.heartbeat=null;this.effect.stopEpoch();/* Failed QUERY/APPLY or result persistence does not authorize RELEASE. Preserve owned changes and report failure to Root. */response=error(m.request_id,e.message);}
  if(p.operation==='APPLY'){const completionView=await this.client.read();if(completionView.lifecycle==='INACTIVE'){this.inactive=true;this.effect.stopEpoch();response=error(m.request_id,'REVALIDATION_REQUIRED');}}
  try{await this.client.commit({kind:'COMPLETE_OPERATION',operation_id:p.operation_id,response});}catch(e){this.inactive=true;this.document.defaultView.clearInterval(this.heartbeat);this.heartbeat=null;this.effect.stopEpoch();/* Failed QUERY/APPLY or result persistence does not authorize RELEASE. Preserve owned changes and report failure to Root. */throw e;}
  if(p.operation==='APPLY'&&this.effect.refresh){let confirmedOutcome=response.status==='OK'?{result_state:response.data.result_state,effect_evidence:response.data.effect_evidence,coverage_evidence:response.data.coverage_evidence}:null;let confirmedDomCapability=null;this.checkpoint=async(force=false)=>{if(this.inactive||this.effect.scanning||this.effect.queuedScans)return;if(!this.effect.running){await this.invalidate('STORE_UNCONFIRMED');return;}const o=this.outcome();const cap=this.client.domCapability,needsDomConfirmation=!!cap&&!same(cap,confirmedDomCapability);if(cap&&!needsDomConfirmation)return;if(!force&&!needsDomConfirmation&&same(o,confirmedOutcome))return;try{await this.client.commit({kind:needsDomConfirmation?'DOM_CONFIRM':'CHECKPOINT',...(needsDomConfirmation?{dom_cap:cap}:{}),operation_id:p.operation_id,round_id:p.round_id,effect_evidence:o.effect_evidence,coverage_evidence:o.coverage_evidence,observed_at:instant()});confirmedOutcome=structuredClone(o);if(needsDomConfirmation)confirmedDomCapability=structuredClone(cap);}catch(error){if(this.p1Attested===true&&error?.message==='INACTIVE_SCOPE'&&error.cause?.source==='ROOT_SUMMARY'){this.inactive=true;this.document.defaultView.clearInterval(this.heartbeat);this.heartbeat=null;this.effect.stopEpoch();return;}console.error('FOCURVE_EFFECT_CHECKPOINT_FAILED',/^[A-Z_]{1,64}$/.test(error?.message??'')?error.message:'UNCONFIRMED');await this.invalidate('STORE_UNCONFIRMED');this.effect.stopEpoch();/* Failure grants no release authority; retain owned changes. */}};const refresh=this.effect.refresh;this.effect.refresh=()=>{refresh();this.effect.pending=this.effect.pending.then(this.checkpoint);};this.heartbeat=this.document.defaultView.setInterval(()=>{this.effect.pending=this.effect.pending.then(()=>this.checkpoint(true));},30000);}
  return response;
 }
 async invalidate(reason='PAGEHIDE'){this.inactive=true;this.document.defaultView.clearInterval(this.heartbeat);this.effect.stopEpoch();
  // An attested P1 receiver has no ordinary storage authority after native URL
  // transition. Suspend locally, retaining all owned changes and durable data;
  // only Root's original scoped RELEASE/ACK may discharge restoration.
  if(this.p1Attested===true&&['ROUTE_CHANGED','PAGEHIDE'].includes(reason))return;
  try{await this.client.commit({kind:'INVALIDATE',reason});}catch{/* Core native invalidation preserves obligations if this response is lost. */}}
 dispose(){if(this.effect.control.changes.size)fail('CLEANUP_REQUIRED');this.disposed=true;this.document.defaultView.clearInterval(this.heartbeat);this.effect.stopEpoch();this.removeListeners?.();}
}
export function installA1(config,chrome,document){
 if(globalThis!==globalThis.top||document.location.protocol!=='https:'||!['youtube.com','www.youtube.com'].includes(document.location.hostname))fail('UNSUPPORTED_POLICY');
 if(!valid(config,'bootstrap'))fail('INVALID_SCHEMA');
 const old=globalThis.__focurveA1Content;if(old){if(!old.canReplace())fail('CLEANUP_REQUIRED');old.dispose();}
 const instance=new A1Content(config,chrome.runtime,document),listener=(m,s,reply)=>{if(m?.type==='D06_P1_PROBE'){respondProbe(m,s,chrome.runtime,instance.config).then(result=>{if(result?.status==='ATTESTED')instance.p1Attested=true;reply(result);},()=>reply({status:'REJECTED'}));return true;}if(m?.type!=='D06_A1_CONTROL')return;instance.handle(m,s).then(reply);return true;};chrome.runtime.onMessage.addListener(listener);
 const registeredHref=document.location.href;
 const pagehide=()=>instance.invalidate('PAGEHIDE'),route=e=>{
  // YouTube can finish the already registered navigation after bootstrap.
  // This notification grants no authority; actual/native navigation still invalidates.
  if(e?.type==='yt-navigate-finish'&&document.location.href===registeredHref)return;
  // Replacing only history state has no new URL/scope. Keep the existing
  // observer alive; DOM changes still use the ordinary ledger/checkpoint path.
  // Actual URL changes, traverse/push, pagehide, inactive epochs remain fenced.
  if(e?.type==='currententrychange'&&e.navigationType==='replace'&&e.from?.url===registeredHref&&document.location.href===registeredHref&&!instance.inactive&&instance.effect.running)return;
  instance.invalidate('ROUTE_CHANGED');
 };document.defaultView.addEventListener('pagehide',pagehide);
 for(const name of ['popstate','hashchange','yt-navigate-finish'])document.defaultView.addEventListener(name,route);
 document.defaultView.navigation?.addEventListener('currententrychange',route);
 instance.removeListeners=()=>{chrome.runtime.onMessage.removeListener(listener);document.defaultView.removeEventListener('pagehide',pagehide);for(const name of ['popstate','hashchange','yt-navigate-finish'])document.defaultView.removeEventListener(name,route);document.defaultView.navigation?.removeEventListener('currententrychange',route);};
 // No receiver, bootstrap, private channel credential, runtime or ledger escapes this closure.
 const facade=Object.freeze({instance:config.scope.content_instance_id,canReplace:()=>instance.inactive&&instance.effect.control.changes.size===0,invalidate:()=>instance.invalidate(),dispose:()=>instance.dispose()});
 Object.defineProperty(globalThis,'__focurveA1Content',{value:facade,writable:false,configurable:true});return config.scope.content_instance_id;
}
