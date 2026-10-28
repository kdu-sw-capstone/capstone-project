import {DocumentRetirementLifecycle} from './document-retirement.mjs';
import {same,fail,digest,valid,VERSION,B5_PROFILE} from './contract.mjs';
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
class LegacyD1Lifecycle {
 #tail=Promise.resolve();
 constructor(core){this.core=core;core.chrome.tabs.onRemoved.addListener(tab=>{
  if(globalThis.FocurveSafetyNavigation?.tab(tab))return;
  const event={id:crypto.randomUUID(),tab,boot:core.boot,profile:core.profile,at:new Date().toISOString()};
  this.#tail=this.#tail.then(()=>this.#removed(event)).catch(e=>{this.lastFailure={code:e.message,event:event.id};});
 });}
 settled(){return this.#tail;}
 async verifyResolved(bundle){
  const rows=await this.core.registry.rows();capacityProfile(rows,bundle.a,true);
  for(const b of bundle.bindings.filter(x=>x.resolution==='GONE_NATIVE')){
   const proof=b.native_resolution_proof,p=rows.find(r=>r.key==='a1:p1:NATIVE_BINDING_PROOF:'+b.scope.binding_id),f=rows.find(r=>r.key==='a1:owner-fence');
   if(!validNativeResolution(proof)||proof.scope_sha256!==await digest(b.scope)||!p||proof.native_proof_sha256!==await digest(p)||proof.profile!==p.profile||proof.owner_fence_sha256!==await digest(f)||b.native_resolution_event!=='TAB_REMOVED')fail('UNAUTHORIZED_SENDER');
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

// The existing guest contract stays the default; no legacy proof synthesis.
export class D1Lifecycle {
 constructor(core){return core.documentRetirement?new DocumentRetirementLifecycle(core):new LegacyD1Lifecycle(core);}
}
