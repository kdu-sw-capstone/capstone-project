// Port of member-a1/d1.mjs; guest contracts, opt-in only.
import {same,fail,digest,valid,VERSION,B5_PROFILE,releaseConfirmed} from './contract.mjs';
import {validP1} from './p1.mjs';
export const D1B5='FOCURVE_D1_B5_1';
export function capacityProfile(rows,a,optIn){
 const markers=rows.filter(r=>r?.key?.startsWith('start:')&&r.session_id===a.session_id),m=markers[0];
 if(!optIn){if(m?.transition_contract||m?.capacity_profile)fail('UNSUPPORTED_POLICY');return null;}
 if(markers.length!==1||!m||m.execution_contract!==VERSION||m.transition_contract!==D1B5||m.native_binding_mode!=='FOCURVE_NATIVE_P1_1'||m.owner_key!==a.owner_context||!same(m.capacity_profile,B5_PROFILE))fail('UNSUPPORTED_POLICY');
 if(!same(a.cleanup_budget,{operation_capacity:160,write_capacity:320}))fail('INVALID_CLEANUP_RESERVATION');
 return structuredClone(m.capacity_profile);
}
export function validNativeResolution(p){return valid(p,'native_resolution_proof')&&new TextEncoder().encode(JSON.stringify(p)).length<=4096;}
// Native callback closure is the only issuer. No runtime message/public event-body grants GONE.
export class DocumentRetirementLifecycle {
 #tail=Promise.resolve();
 #replacements=new Map();
 #gateDocuments=new Map();
 #latestCommit=new Map();
 #committed=new Map();
 constructor(core){this.core=core;
 if(core.shortsDocumentGate)core.chrome.runtime.onMessage?.addListener((message,sender)=>{
  // Only Chrome-populated MessageSender metadata enters this closure. Payload
  // document IDs, URLs, or lifecycle claims are never accepted as evidence.
  if(message?.type!=='FOCURVE_SHORTS_GATE_STATUS'||sender.id!==core.chrome.runtime.id||sender.frameId!==0||sender.documentLifecycle!=='active'||!sender.documentId||!Number.isInteger(sender.tab?.id))return;
  let url;try{url=new URL(sender.url);}catch{return;}
  if(url.protocol!=='chrome-extension:'||url.hostname!==core.chrome.runtime.id||url.pathname!=='/blocked/shorts.html'||url.searchParams.getAll('session').length!==1||url.searchParams.get('session')!==message.session)return;
  this.#gateDocuments.set(sender.documentId,{tab:sender.tab.id,session:message.session,url:sender.url});if(this.#gateDocuments.size>32)this.#gateDocuments.delete(this.#gateDocuments.keys().next().value);
 });
core.chrome.tabs.onRemoved.addListener(tab=>{
  if(globalThis.FocurveSafetyNavigation?.tab(tab))return;
  const event={id:crypto.randomUUID(),tab,boot:core.boot,profile:core.profile,at:new Date().toISOString()};
  this.#tail=this.#tail.then(()=>this.#removed(event)).catch(e=>{this.lastFailure={code:e.message,event:event.id};});
 });
 if(core.documentRetirement)core.chrome.webNavigation.onCommitted.addListener(d=>{if(globalThis.FocurveSafetyNavigation?.document(d)||d.frameId!==0)return;this.#latestCommit.set(d.tabId,d.documentId);this.#committed.set(d.tabId,structuredClone(d));while(this.#committed.size>32)this.#committed.delete(this.#committed.keys().next().value);const pending=this.#replacements.get(d.tabId);if(pending)this.#queueRetirement(pending,d);});
 }
 #queueRetirement(pending,d){
  if(pending.queued)return;pending.queued=true;
  this.#tail=this.#tail.then(()=>this.#retired(pending,d)).catch(async e=>{this.lastFailure={code:e.message};this.core.captureFirstFailure?.(e);await this.core.markUnknown(e.message);}).finally(()=>{if(this.#replacements.get(d.tabId)===pending)this.#replacements.delete(d.tabId);this.core.requestCheck();});
 }
 replacementPending(){return this.#replacements.size>0;}
 async committedReplacement(bundle,binding){
  // Native commit may be delivered without beforeNavigate (e.g. history).
  // Reuse the original retirement proof path; absence alone is never proof.
  const c=this.core,d=this.#committed.get(binding.scope.tab_id),now=c.now();
  const current=bundle.bindings.find(x=>x.scope.binding_id===binding.scope.binding_id);
  // P1's native read may have yielded to a completed retirement. Reuse that
  // exact resolution, rather than opening another window against the new doc.
  if(current&&same(current.scope,binding.scope)&&current.resolution==='GONE_NATIVE'&&bundle.a.intent!=='END'&&!bundle.a.nr_first_failure){
   c.nrCheck(bundle.a);await this.verifyResolved(bundle);const latest=await c.bundle();
   if(latest&&latest.a.session_id===bundle.a.session_id&&latest.a.owner_context===bundle.a.owner_context&&latest.a.executor_id===bundle.a.executor_id&&latest.ownerFenceEpoch===bundle.ownerFenceEpoch&&same(latest.a.snapshot_ref,bundle.a.snapshot_ref)&&latest.a.desired_revision===bundle.a.desired_revision&&latest.a.intent!=='END'&&!latest.a.nr_first_failure&&['RUNNING','NATIVE_VERIFYING'].includes(latest.a.session_status)&&latest.bindings.some(x=>same(x.scope,binding.scope)&&x.resolution==='GONE_NATIVE')){c.nrCheck(latest.a);await this.verifyResolved(latest);return latest;}
   return null;
  }
  if(!c.documentRetirement||!d||d.frameId!==0||d.documentLifecycle!=='active'||d.documentId===binding.scope.document_id||this.#latestCommit.get(d.tabId)!==d.documentId||!Number.isFinite(d.timeStamp)||now<d.timeStamp||now-d.timeStamp>=5000||!['reload','link','typed','auto_bookmark','generated','start_page','form_submit','keyword','keyword_generated'].includes(d.transitionType)||!(bundle.a.session_status==='RUNNING'||c.nrPending(bundle.a))||bundle.a.intent==='END'||bundle.a.nr_first_failure||this.#replacements.has(d.tabId))return null;
  // Enter only the negative-authority NR window first. #retired performs both
  // exact native reads (or the existing owned-gate Sender fallback) inside it.
  // No applied effect/RUNNING proof is granted by opening this window.
  const priorDeadline=c.nrPending(bundle.a)?bundle.a.native_transition.deadline_at:null;if(priorDeadline)c.nrCheck(bundle.a);
  if(!await this.beforeNavigation(bundle,d,{withinNative:priorDeadline!==null,committedDocumentId:d.documentId}))return null;await this.settled();
  const after=await c.bundle(),retired=after?.bindings.find(x=>x.scope.binding_id===binding.scope.binding_id);
  if(!after||after.a.session_id!==bundle.a.session_id||after.a.owner_context!==bundle.a.owner_context||after.ownerFenceEpoch!==bundle.ownerFenceEpoch||after.a.session_status==='UNKNOWN'||retired?.resolution!=='GONE_NATIVE')return null;
  c.nrCheck(after.a);if(priorDeadline!==null&&after.a.native_transition?.deadline_at!==priorDeadline)fail('INVALID_TRANSITION_STATE');return after;
 }
 async beforeNavigation(bundle,d,{withinNative=false,committedDocumentId=null}={}){
  const c=this.core;if(!c.documentRetirement||!c.nrEnabled(bundle.a)||!(['RUNNING','EFFECT_VERIFYING'].includes(bundle.a.session_status)||withinNative&&c.nrPending(bundle.a))||bundle.a.session_status==='EFFECT_VERIFYING'&&!c.dom?.active(bundle.a)||bundle.a.intent==='END'||bundle.a.nr_first_failure||typeof c.chrome.webNavigation.getFrame!=='function')return false;
  if(this.#replacements.has(d.tabId))return true;
  const p={tab:d.tabId,boot:c.boot,profile:c.profile,session:bundle.a.session_id,owner:bundle.a.owner_context,fence:bundle.ownerFenceEpoch,beforeTime:d.timeStamp,queued:false,sourceUrl:typeof d.url==='string'?d.url:null,targets:bundle.bindings.filter(b=>b.scope.tab_id===d.tabId&&b.resolution==='NONE'&&b.scope.document_id!==committedDocumentId).map(b=>structuredClone(b.scope))};
  if(!p.targets.length)return false;this.#replacements.set(d.tabId,p);
  p.begin=c.nrBegin(bundle,{timeStamp:d.timeStamp});try{if(!await p.begin){this.#replacements.delete(d.tabId);return false;}
   // Native onCommitted may arrive while the Root snapshot/server wait yields.
   // Reuse only a Chrome event newer than this exact native onBeforeNavigate;
   // it is a scheduling hint, never substitute disappearance/owner proof.
   const committed=this.#committed.get(d.tabId);
   // Equal millisecond timestamps can describe the outgoing document's old
   // commit. It is never evidence of a replacement of that same document.
   if(!p.queued&&Number.isFinite(p.beforeTime)&&Number.isFinite(committed?.timeStamp)&&committed.timeStamp>=p.beforeTime&&p.targets.every(scope=>scope.document_id!==committed.documentId))this.#queueRetirement(p,committed);
   return true;}catch(e){this.#replacements.delete(d.tabId);await c.markUnknown(e.message);throw e;}
 }
 async #gateFrame(d,bundle){
  const c=this.core;if(!c.shortsDocumentGate)return null;let url;try{url=new URL(d.url);}catch{return null;}if(url.protocol!=='chrome-extension:'||url.hostname!==c.chrome.runtime.id||url.pathname!=='/blocked/shorts.html'||url.searchParams.getAll('session').length!==1||url.searchParams.get('session')!==bundle.a.session_id)return null;
  const deadline=Math.min(bundle.a.native_transition.deadline_at,c.now()+1500),wallDeadline=performance.now()+Math.max(0,deadline-c.now());
  while(c.now()<deadline&&performance.now()<wallDeadline){
   if(this.#latestCommit.get(d.tabId)!==d.documentId)return null;
   const proof=this.#gateDocuments.get(d.documentId);
   if(proof){if(proof.tab!==d.tabId||proof.session!==bundle.a.session_id)return null;const tab=await c.chrome.tabs.get(d.tabId);if(tab.url!==proof.url||tab.pendingUrl&&tab.pendingUrl!==proof.url)return null;return {documentId:d.documentId,documentLifecycle:'active',frameType:'outermost_frame',errorOccurred:false};}
   await new Promise(resolve=>setTimeout(resolve,25));
  }return null;
 }
 async #retired(event,d){
  const c=this.core;await event.begin;let bundle=await c.bundle();
  if(!bundle||event.boot!==c.boot||event.profile!==c.profile||event.session!==bundle.a.session_id||event.owner!==bundle.a.owner_context||event.fence!==bundle.ownerFenceEpoch||bundle.a.intent==='END'||bundle.a.nr_first_failure||!c.nrPending(bundle.a)||!['reload','link','typed','auto_bookmark','generated','start_page','form_submit','keyword','keyword_generated'].includes(d.transitionType)||d.documentLifecycle!=='active'||!d.documentId)fail('REVALIDATION_REQUIRED');c.nrCheck(bundle.a);
  const captures=[];
  for(const scope of event.targets){
   const b=await c.store.read('a1:binding:'+scope.binding_id);if(!b||!same(b.scope,scope))fail('SCOPE_MISMATCH');
   // Cleanup may finish while this native callback waits. Keep its original
   // verified RELEASE; do not overwrite it with GONE or send RELEASE again.
   if(b.resolution==='RELEASE_VERIFIED'&&b.ordinary_authority==='REVOKED'&&releaseConfirmed(b.release_evidence))continue;
   if(b.resolution!=='NONE'||d.documentId===scope.document_id)fail('SCOPE_MISMATCH');
   // Exact document-ID lookups include cached documents. Exceptions, cached,
   // active, or pending-deletion results are NOT disappearance evidence.
   for(let n=0;n<2;n++){
    const old=await c.chrome.webNavigation.getFrame({documentId:scope.document_id});
    const nativeFresh=await c.chrome.webNavigation.getFrame({tabId:event.tab,frameId:0,documentId:d.documentId});const fresh=nativeFresh??await this.#gateFrame(d,bundle);
    const rejected=[];if(old!=null)rejected.push('prior_document_present');if(!fresh)rejected.push('replacement_document_missing');else{if(fresh.documentId!==d.documentId)rejected.push('replacement_document_identity');if(fresh.documentLifecycle!=='active')rejected.push('document_lifecycle');if(fresh.frameType!=='outermost_frame')rejected.push('replacement_frame_type');if(fresh.errorOccurred)rejected.push('replacement_error');}if(rejected.length)throw new Error('REVALIDATION_REQUIRED',{cause:{stage:'DOCUMENT_RETIREMENT_GUARD',rejected_fields:rejected}});
   }
   const rows=await c.registry.rows(),p=rows.find(r=>r.key==='a1:p1:NATIVE_BINDING_PROOF:'+scope.binding_id),f=rows.find(r=>r.key==='a1:owner-fence');
   if(!validP1(p)||p.phase!=='ATTESTED'||p.creation_boot!==c.boot||p.profile!==c.profile||p.scope_sha256!==await digest(scope)||p.fence_epoch!==event.fence||p.owner_context!==event.owner||p.session_id!==event.session||p.document_id!==scope.document_id||p.tab_id!==scope.tab_id||p.credential_sha256!==await digestRaw(b.channel_credential))fail('UNAUTHORIZED_SENDER');
   const originals=rows.filter(r=>['A1_OPERATION','A1_WRITE_RECEIPT','CLEANUP_LEASE','NATIVE_BINDING_PROOF','NATIVE_BOOT_REVALIDATION'].includes(r.record_kind)&&r.binding_id===scope.binding_id);
   if(originals.some(r=>r.record_kind==='A1_OPERATION'&&['IN_FLIGHT','IN_DOUBT'].includes(r.phase)))fail('STORE_UNCONFIRMED');
   const proof={version:'FOCURVE_DOCUMENT_RETIREMENT_1',kind:d.transitionType==='reload'?'ROOT_RELOAD_DOCUMENT_RETIRED':'ROOT_DOCUMENT_RETIRED',event_id:crypto.randomUUID(),profile:c.profile,boot:c.boot,scope_sha256:await digest(scope),native_proof_sha256:await digest(p),owner_fence_sha256:await digest(f),prior_record_version:b.record_version,original_records_sha256:await digest({records:originals,ledger:b.ledger,budget:b.cleanup_reservation}),observed_at:new Date().toISOString(),replacement_document_id:d.documentId};const gate=this.#gateDocuments.get(d.documentId);if(c.shortsDocumentGate&&gate?.tab===event.tab&&gate.session===event.session&&event.sourceUrl){const source=new URL(event.sourceUrl);if(source.protocol==='https:'&&['youtube.com','www.youtube.com'].includes(source.hostname)&&/^\/shorts\/[^/]+\/?$/.test(source.pathname)){const installed=await c.chrome.declarativeNetRequest.getSessionRules();const rule=bundle.state.journal.rules.find(r=>r.action?.redirect?.regexSubstitution?.startsWith(c.shortsGateUrl(bundle.state.session)+'&target=')&&r.condition?.resourceTypes?.includes('main_frame')&&new RegExp(r.condition.regexFilter).test(source.href));if(rule&&installed.some(r=>same(r,rule)))proof.gate_effect={version:'ROOT_DNR_SHORTS_GUARD_1',entry_sha256:await digestRaw(source.origin+source.pathname),rule_id:rule.id,rule_sha256:await digest(rule)};}}if(!validNativeResolution(proof))fail('INVALID_SCHEMA');captures.push({b,originals,proof});
  }
  bundle=await c.bundle();c.nrCheck(bundle.a);if(bundle.a.nr_first_failure||bundle.a.intent==='END'||bundle.ownerFenceEpoch!==event.fence)fail('REVALIDATION_REQUIRED');
  await c.updateBundle(bundle,({a,rows,tx})=>{for(const {b,originals,proof} of captures){const current=rows.find(r=>r.key===b.key),now=rows.filter(r=>['A1_OPERATION','A1_WRITE_RECEIPT','CLEANUP_LEASE','NATIVE_BINDING_PROOF','NATIVE_BOOT_REVALIDATION'].includes(r.record_kind)&&r.binding_id===b.scope.binding_id);if(!same(b,current)||!same(now,originals))fail('STORE_CAS_CONFLICT');current.ordinary_authority='INACTIVE';current.apply_closed=true;current.resolution='GONE_NATIVE';current.native_lifecycle='GONE';current.cleanup_pending=false;current.native_resolution_event='DOCUMENT_RETIRED';current.native_resolution_proof=proof;current.record_version=crypto.randomUUID();if(!valid(current,'binding'))fail('INVALID_SCHEMA');tx.objectStore('metadata').put(current);}return a;});
 }
 settled(){return this.#tail;}
 async featureProof(draft,context){
  const c=this.core,bundle=await c.bundle();if(!c.shortsDocumentGate||!bundle||!(bundle.a.session_status==='RUNNING'||c.nrPending(bundle.a))||bundle.a.intent==='END'||bundle.a.session_id!==context.session_id||bundle.a.owner_context!==context.owner_key||bundle.a.executor_id!==context.executor_id||bundle.a.snapshot_ref.policy_snapshot_id!==context.snapshot.policy_snapshot_id||draft.session_id!==context.session_id||draft.owner_key!==context.owner_key||draft.executor_id!==context.executor_id)return false;
  const binding=bundle.bindings.find(b=>b.scope.tab_id===draft.native_tab_id&&b.scope.document_id===draft.document_id&&b.scope.target_host===draft.target_host&&b.scope.matched_policy_host===draft.policy_host&&b.resolution==='GONE_NATIVE'&&b.native_resolution_event==='DOCUMENT_RETIRED');if(!binding)return false;const proof=binding.native_resolution_proof,effect=proof?.gate_effect;if(!validNativeResolution(proof)||effect?.version!=='ROOT_DNR_SHORTS_GUARD_1'||effect.entry_sha256!==draft.entry_fingerprint||Date.parse(proof.observed_at)<draft.captured_at)return false;
  await this.verifyResolved(bundle);const owned=bundle.state.journal.rules.find(r=>r.id===effect.rule_id),installed=await c.chrome.declarativeNetRequest.getSessionRules();if(!owned||await digest(owned)!==effect.rule_sha256||!installed.some(r=>same(r,owned)))return false;const fresh=await c.bundle();return fresh.a.record_version===bundle.a.record_version&&fresh.ownerFenceEpoch===bundle.ownerFenceEpoch;
 }
 async verifyResolved(bundle){
  const rows=await this.core.registry.rows();capacityProfile(rows,bundle.a,true);
  for(const b of bundle.bindings.filter(x=>x.resolution==='GONE_NATIVE')){
   const proof=b.native_resolution_proof,p=rows.find(r=>r.key==='a1:p1:NATIVE_BINDING_PROOF:'+b.scope.binding_id),f=rows.find(r=>r.key==='a1:owner-fence');
   if(!validNativeResolution(proof)||proof.scope_sha256!==await digest(b.scope)||!p||proof.native_proof_sha256!==await digest(p)||proof.profile!==p.profile||proof.owner_fence_sha256!==await digest(f)||!(b.native_resolution_event==='TAB_REMOVED'&&proof.kind==='ROOT_TAB_REMOVED'&&proof.version===D1B5||this.core.documentRetirement&&b.native_resolution_event==='DOCUMENT_RETIRED'&&['ROOT_RELOAD_DOCUMENT_RETIRED','ROOT_DOCUMENT_RETIRED'].includes(proof.kind)&&proof.version==='FOCURVE_DOCUMENT_RETIREMENT_1'&&proof.replacement_document_id))fail('UNAUTHORIZED_SENDER');
  }
 }
 async #removed(event){
  const c=this.core;await c.ready;if(c.boot!==event.boot||c.profile!==event.profile)fail('GENERATION_CHANGED');
  let bundle=await c.bundle();if(!bundle||['ENDED','START_FAILED','INTERRUPTED'].includes(bundle.a.session_status))return;
  capacityProfile(await c.registry.rows(),bundle.a,true);
  const targets=bundle.bindings.filter(b=>b.scope.tab_id===event.tab&&b.resolution==='NONE').map(b=>({key:b.key,scope:structuredClone(b.scope),registration:b.registration_id,epoch:b.registration_epoch,credential:b.channel_credential}));
  if(!targets.length)return;
  const owner=bundle.a.owner_context,session=bundle.a.session_id,fence=bundle.ownerFenceEpoch;
  for(let attempt=0;attempt<3;attempt++){
   bundle=await c.bundle();if(!bundle||c.boot!==event.boot||c.profile!==event.profile||bundle.a.session_id!==session||bundle.a.owner_context!==owner||bundle.ownerFenceEpoch!==fence)fail('OWNER_MISMATCH');
   const rows=await c.registry.rows(),captures=[];
   for(const t of targets){
    const b=rows.find(r=>r.key===t.key);if(!b||!same(b.scope,t.scope)||b.registration_id!==t.registration||b.registration_epoch!==t.epoch||b.channel_credential!==t.credential)fail('SCOPE_MISMATCH');
    if(b.resolution!=='NONE')continue;
    const p=rows.find(r=>r.key==='a1:p1:NATIVE_BINDING_PROOF:'+b.scope.binding_id),f=rows.find(r=>r.key==='a1:owner-fence');
    // No legacy/provisional proof synthesis. Missing pre-effect proof retains debt.
    if(!validP1(p)||p?.phase!=='ATTESTED'||p.profile!==event.profile||p.binding_id!==b.scope.binding_id||p.owner_context!==b.scope.owner_context||p.executor_id!==b.scope.executor_id||p.session_id!==b.scope.session_id||p.tab_id!==b.scope.tab_id||p.frame_id!==0||p.document_id!==b.scope.document_id||p.registration_epoch!==b.registration_epoch||p.content_instance!==b.scope.content_instance_id||p.snapshot_sha256!==await digest(b.scope.snapshot_ref)||p.scope_sha256!==await digest(b.scope)||p.fence_epoch!==fence||p.credential_sha256!==await digestRaw(b.channel_credential))fail('UNAUTHORIZED_SENDER');
    const originals=rows.filter(r=>['A1_OPERATION','A1_WRITE_RECEIPT','CLEANUP_LEASE','NATIVE_BINDING_PROOF','NATIVE_BOOT_REVALIDATION'].includes(r.record_kind)&&r.binding_id===b.scope.binding_id);
    const proof={version:D1B5,kind:'ROOT_TAB_REMOVED',event_id:event.id,profile:event.profile,boot:event.boot,scope_sha256:await digest(b.scope),native_proof_sha256:await digest(p),owner_fence_sha256:await digest(f),prior_record_version:b.record_version,original_records_sha256:await digest({records:originals,ledger:b.ledger,budget:b.cleanup_reservation}),observed_at:event.at};
    // TAB_REMOVED has no replacement commit and cannot issue gate-effect proof.
    if(!validNativeResolution(proof))fail('INVALID_SCHEMA');captures.push({b,originals,proof});
   }
   if(!captures.length)return;
   try{
    await c.updateBundle(bundle,({a,state,rows,tx})=>{
     if(c.boot!==event.boot||c.profile!==event.profile)fail('GENERATION_CHANGED');capacityProfile(rows,a,true);
     for(const capture of captures){const {b,originals,proof}=capture,current=rows.find(r=>r.key===b.key),nowOriginals=rows.filter(r=>['A1_OPERATION','A1_WRITE_RECEIPT','CLEANUP_LEASE','NATIVE_BINDING_PROOF','NATIVE_BOOT_REVALIDATION'].includes(r.record_kind)&&r.binding_id===b.scope.binding_id);
      if(!same(current,b)||!same(nowOriginals,originals))fail('STORE_CAS_CONFLICT');
      current.ordinary_authority='INACTIVE';current.apply_closed=true;current.resolution='GONE_NATIVE';current.native_resolution_event='TAB_REMOVED';current.native_lifecycle='GONE';current.cleanup_pending=false;current.native_resolution_proof=proof;current.record_version=crypto.randomUUID();
      if(!valid(current,'binding'))fail('INVALID_SCHEMA');tx.objectStore('metadata').put(current);
     }
     // Resolve the native obligation, never forge a successful Content RELEASE/ACK.
     if(a.generation===Number.MAX_SAFE_INTEGER)fail('INVALID_TRANSITION');a.generation++;invalidate(a,state,tx);return a;
    });c.clock=null;c.requestCheck();this.lastRemoval={event:event.id,bindings:captures.length,status:'PERSISTED'};return;
   }catch(e){if(!['GENERATION_CHANGED','STORE_CAS_CONFLICT'].includes(e.message)||attempt===2)throw e;}
  }
 }
}
async function digestRaw(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
// Avoid a new Session/UI state: use existing invalidation semantics and END priority.
import {invalidateAggregate} from './domain.mjs';
function invalidate(a,state,tx){invalidateAggregate(a,state.session,state.journal,tx,'RESPONSE_UNCONFIRMED');}
