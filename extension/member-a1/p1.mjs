import {same,fail,digest,valid,workerSender} from './contract.mjs';

// Independent opt-in P1 implementation. No legacy proof synthesis.
export const P1='FOCURVE_NATIVE_P1_1';
export const rawHash=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const key=(kind,b)=>'a1:p1:'+kind+':'+b.scope.binding_id;
const uuid=()=>crypto.randomUUID();
const fields={
 NATIVE_BINDING_PROOF:['phase','reserved_sidecars','proof_id','scope_sha256','snapshot_sha256','registration_epoch','content_instance','credential_sha256','receiver_sha256','tab_id','frame_id','document_id','origin','sender_url_sha256','native_url_sha256','creation_boot','profile','generation','fence_epoch','challenge_id','challenge_sha256','pre_effect'],
 CLEANUP_LEASE:['proof_id','proof_version','operation_id','command_sha256','cleanup_authorization_id','scope_sha256','boot','profile','generation','fence_epoch','native_url_sha256','native_nonce','observed_at','expires_at','phase','execution_id','begin_write_id','receipt_ids'],
 NATIVE_BOOT_REVALIDATION:['proof_id','proof_version','boot','profile','generation','fence_epoch','native_url_sha256','challenge_id','challenge_sha256','scope_sha256']
};
const common=['schema_version','record_kind','key','record_version','binding_id','owner_context','executor_id','session_id'];
export function validP1(r){
 if(!r||!fields[r.record_kind]||r.schema_version!==P1||!same(Object.keys(r).sort(),[...common,...fields[r.record_kind]].sort()))return false;
 if(common.some(k=>typeof r[k]!=='string'||!r[k])||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(r.record_version)||r.key!=='a1:p1:'+r.record_kind+':'+r.binding_id)return false;
 if(new TextEncoder().encode(JSON.stringify(r)).length>16384)return false;
 if(r.record_kind==='NATIVE_BINDING_PROOF'){
  if(r.reserved_sidecars!==3||!['RESERVED','ATTESTED'].includes(r.phase))return false;
  if(r.phase==='RESERVED')return fields[r.record_kind].filter(k=>!['phase','reserved_sidecars'].includes(k)).every(k=>r[k]===null);
  if(r.frame_id!==0||!Number.isInteger(r.tab_id)||!Number.isSafeInteger(r.generation)||r.pre_effect!==true)return false;
  return fields[r.record_kind].filter(k=>!['phase','reserved_sidecars','tab_id','frame_id','generation','pre_effect'].includes(k)).every(k=>typeof r[k]==='string'&&r[k].length>0)&&['scope_sha256','snapshot_sha256','credential_sha256','receiver_sha256','sender_url_sha256','native_url_sha256','challenge_sha256'].every(k=>/^[a-f0-9]{64}$/.test(r[k]));
 }
 if(!Number.isSafeInteger(r.generation)||r.generation<0||fields[r.record_kind].filter(k=>!['generation','observed_at','expires_at','receipt_ids','begin_write_id'].includes(k)).some(k=>typeof r[k]!=='string'||!r[k])||['scope_sha256','native_url_sha256',...(r.record_kind==='CLEANUP_LEASE'?['command_sha256']:['challenge_sha256'])].some(k=>!/^[a-f0-9]{64}$/.test(r[k])))return false;
 if(r.record_kind==='CLEANUP_LEASE')return ['OPEN','EXECUTING','COMPLETED','EXPIRED'].includes(r.phase)&&Number.isFinite(r.observed_at)&&Number.isFinite(r.expires_at)&&r.expires_at>r.observed_at&&Array.isArray(r.receipt_ids)&&r.receipt_ids.length<=2&&r.receipt_ids.every(x=>typeof x==='string')&&(r.begin_write_id===null||typeof r.begin_write_id==='string');
 return true;
}
const base=(kind,b)=>({schema_version:P1,record_kind:kind,key:key(kind,b),record_version:uuid(),binding_id:b.scope.binding_id,owner_context:b.scope.owner_context,executor_id:b.scope.executor_id,session_id:b.scope.session_id});
export function reserveP1(b,rows,md){
 // Three bounded sidecars occupy existing normal metadata capacity. Never add
 // operation/write credit. Reserve before any QUERY/APPLY or native effect.
 const occupied=rows.filter(r=>r.binding_id===b.scope.binding_id&&r.record_kind==='A1_WRITE_RECEIPT'&&!r.cleanup_slot).length;
 if(occupied+3>=1024||rows.some(r=>r.key===key('NATIVE_BINDING_PROOF',b)))fail('STORE_CAPACITY');
 const r={...base('NATIVE_BINDING_PROOF',b),...Object.fromEntries(fields.NATIVE_BINDING_PROOF.map(k=>[k,null])),phase:'RESERVED',reserved_sidecars:3};
 if(!validP1(r))fail('INVALID_SCHEMA');md.add(r);
}
// Diagnostic metadata only: no wire/store/authentication predicate changes.
const denied=(code,stage,checks)=>{throw new Error(code,{cause:{stage,checks}});};
const checked=(r,kind)=>{if(!r||r.record_kind!==kind||!validP1(r))denied('UNAUTHORIZED_SENDER','P1_RECORD_GUARD',{record_present:!!r,record_kind_matches:r?.record_kind===kind,record_schema_valid:!!r&&validP1(r)});return r;};
export class P1Native {
 constructor(core){this.core=core;this.pending=new Map();this.live=new Map();this.handoffs=new Map();this.transitionCount=0;}
 routeEligible(a,b,p,nativeHash,fenceEpoch){
  const c=this.core,n=a?.native_transition;
  return c.env.experimentalDocumentCoordinator===true&&c.nrPending(a)&&!a.nr_first_failure&&a.intent!=='END'&&
   n.boot===c.boot&&n.profile===c.profile&&c.now()>=n.started_at&&c.now()<n.deadline_at&&n.deadline_at-n.started_at===5000&&
   p.creation_boot===c.boot&&p.profile===c.profile&&p.phase==='ATTESTED'&&p.fence_epoch===fenceEpoch&&
   a.owner_context===b.scope.owner_context&&a.executor_id===b.scope.executor_id&&a.session_id===b.scope.session_id&&
   b.resolution==='NONE'&&b.ordinary_authority==='INACTIVE'&&b.apply_closed&&
   nativeHash!==p.native_url_sha256&&n.old.some(r=>r.binding_id===b.scope.binding_id&&r.proof_version===p.record_version&&r.scope_sha256===p.scope_sha256);
 }
 handoffMatches(h,a,b,p,nativeHash,fenceEpoch){
  return !!h&&this.routeEligible(a,b,p,nativeHash,fenceEpoch)&&h.boot===this.core.boot&&h.profile===this.core.profile&&
   h.generation===a.generation&&h.transition===a.native_transition.transition_id&&h.expires===a.native_transition.deadline_at&&
   h.proof_version===p.record_version&&h.scope_hash===p.scope_sha256&&h.native_hash===nativeHash&&h.fence_epoch===fenceEpoch;
 }
 holdTransition(){if(this.transitionCount++===0)this.transitionPending=new Promise(resolve=>{this.transitionResolve=resolve;});let released=false;return ()=>{if(released)return;released=true;if(--this.transitionCount===0){this.transitionResolve();this.transitionPending=null;}};}
 async frame(b){const fs=await this.core.chrome.webNavigation.getAllFrames({tabId:b.scope.tab_id});const f=fs?.find(f=>f.frameId===0&&f.documentId===b.scope.document_id);if(!f||f.documentLifecycle!=='active')denied('UNAUTHORIZED_SENDER','P1_NATIVE_FRAME',{native_document_found:!!f,native_lifecycle_active:f?.documentLifecycle==='active'});const u=new URL(f.url);if(u.protocol!=='https:'||!['youtube.com','www.youtube.com'].includes(u.hostname)||u.hostname!==b.scope.target_host)denied('SCOPE_MISMATCH','P1_NATIVE_SCOPE',{https:u.protocol==='https:',supported_host:['youtube.com','www.youtube.com'].includes(u.hostname),scope_host:u.hostname===b.scope.target_host});const bundle=await this.core.bundle({includeBindings:false});const site=this.core.env.policy.select(bundle.state.session.snapshot.sites,f.url);if(!site||site.access_policy==='BLOCK'||!site.feature_policies.some(x=>x.feature_code==='YOUTUBE_SHORTS'&&x.enabled))fail('UNSUPPORTED_POLICY');return {...f,origin:u.origin,url_sha256:await rawHash(f.url)};}
 async attest(b,{revalidate=false}={}){
  const {core}=this,f=await this.frame(b),bundle=await core.bundle(),proof=await core.store.read(key('NATIVE_BINDING_PROOF',b));
  checked(proof,'NATIVE_BINDING_PROOF');if(proof.phase!==(revalidate?'ATTESTED':'RESERVED'))fail('INACTIVE_SCOPE');
  const challenge={id:uuid(),nonce:uuid(),binding:b.scope.binding_id,registration:b.registration_id,epoch:b.registration_epoch,boot:core.boot};
  const route=revalidate&&this.routeEligible(bundle.a,b,proof,f.url_sha256,bundle.ownerFenceEpoch);
  const bootRecord=await core.store.read(key('NATIVE_BOOT_REVALIDATION',b));
  const responseBudget=core.nativeResponseBudget(bundle.a),fp=await digest(challenge),pending={b:structuredClone(b),f,bundle,proof,challenge,fp,revalidate,route,boot_record_version:bootRecord?.record_version??null,expires:Date.now()+responseBudget.milliseconds,received:false};this.pending.set(challenge.id,pending);
  let timer;try{
   const result=await Promise.race([core.chrome.tabs.sendMessage(b.scope.tab_id,{type:'D06_MEMBER_P1_PROBE',challenge,fingerprint:fp},{documentId:b.scope.document_id}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(core.nativeResponseTimeout(bundle.a,responseBudget)),responseBudget.milliseconds);})]);
   if(responseBudget.native)core.nrCheck(bundle.a);if(!result||result.id!==challenge.id||result.fingerprint!==fp||result.status!=='ATTESTED')fail('STORE_UNCONFIRMED');
   const persisted=await core.store.read(revalidate?key('NATIVE_BOOT_REVALIDATION',b):proof.key);if(!persisted||persisted.challenge_id!==challenge.id||!validP1(persisted))fail('STORE_UNCONFIRMED');
   return persisted;
  }finally{clearTimeout(timer);this.pending.delete(challenge.id);}
 }
 async receive(m,s){
  if(!m||!same(Object.keys(m).sort(),['type','challenge','fingerprint','scope','registration_id','registration_epoch','credential'].sort())||m.type!=='D06_MEMBER_P1_ATTEST')fail('INVALID_SCHEMA');
  const p=this.pending.get(m.challenge?.id);if(!p||p.received||Date.now()>p.expires||!same(m.challenge,p.challenge)||m.fingerprint!==p.fp||!same(m.scope,p.b.scope)||m.registration_id!==p.b.registration_id||m.registration_epoch!==p.b.registration_epoch||m.credential!==p.b.channel_credential)fail('UNAUTHORIZED_SENDER');
  const b=p.b,c=this.core,f=await this.frame(b);
  if(s?.id!==c.chrome.runtime.id||s.tab?.id!==b.scope.tab_id||s.frameId!==0||s.documentId!==b.scope.document_id||s.documentLifecycle!=='active'||s.origin!==f.origin||typeof s.url!=='string'||new URL(s.url).origin!==f.origin||f.url!==p.f.url)fail('UNAUTHORIZED_SENDER');
  if(p.received)fail('UNAUTHORIZED_SENDER');p.received=true;
  const values={scope_sha256:await digest(b.scope),snapshot_sha256:await digest(b.scope.snapshot_ref),credential_sha256:await rawHash(b.channel_credential),sender_url_sha256:await rawHash(s.url),receiver_sha256:await c.receiverDigest()};
  await c.registry.update((rows,tx)=>{
   const current=rows.find(r=>r.key===b.key),a=rows.find(r=>r.key===p.bundle.a.key),fence=rows.find(r=>r.key==='a1:owner-fence'),slot=rows.find(r=>r.key===p.proof.key);
   if(this.pending.get(p.challenge.id)!==p||Date.now()>p.expires||!current||current.record_version!==b.record_version||!same(current.scope,b.scope)||!a||a.record_version!==p.bundle.a.record_version||a.generation!==p.bundle.a.generation||a.intent==='END'&&!p.revalidate||!fence||fence.transitioning||fence.epoch!==p.bundle.ownerFenceEpoch||fence.owner_context!==b.scope.owner_context||slot?.record_version!==p.proof.record_version)fail('STORE_CAS_CONFLICT');
   let result;
   if(p.revalidate){
    if((rows.find(r=>r.key===key('NATIVE_BOOT_REVALIDATION',b))?.record_version??null)!==p.boot_record_version)fail('STORE_CAS_CONFLICT');
    const route=p.route&&this.routeEligible(a,current,p.proof,f.url_sha256,fence.epoch)&&
     [p.proof.sender_url_sha256,f.url_sha256].includes(values.sender_url_sha256);
    if(p.route&&!route)fail('UNAUTHORIZED_SENDER');
    if(p.proof.profile!==c.profile||(!route&&p.proof.sender_url_sha256!==values.sender_url_sha256)||p.proof.scope_sha256!==values.scope_sha256||p.proof.credential_sha256!==values.credential_sha256||p.proof.receiver_sha256!==values.receiver_sha256)fail('UNAUTHORIZED_SENDER');
    result={...base('NATIVE_BOOT_REVALIDATION',b),proof_id:p.proof.proof_id,proof_version:p.proof.record_version,boot:c.boot,profile:c.profile,generation:a.generation,fence_epoch:fence.epoch,native_url_sha256:f.url_sha256,challenge_id:p.challenge.id,challenge_sha256:p.fp,scope_sha256:values.scope_sha256};
   }else{
    if(current.readiness!=='PROVISIONAL'||current.resolution!=='NONE'||current.cleanup_pending||current.ledger.length||rows.some(r=>r.record_kind==='A1_OPERATION'&&r.binding_id===b.scope.binding_id))fail('INACTIVE_SCOPE');
    result={...slot,record_version:uuid(),phase:'ATTESTED',proof_id:uuid(),...values,registration_epoch:b.registration_epoch,content_instance:b.scope.content_instance_id,tab_id:b.scope.tab_id,frame_id:0,document_id:b.scope.document_id,origin:f.origin,native_url_sha256:f.url_sha256,creation_boot:c.boot,profile:c.profile,generation:a.generation,fence_epoch:fence.epoch,challenge_id:p.challenge.id,challenge_sha256:p.fp,pre_effect:true};
   }
   if(!validP1(result))fail('INVALID_SCHEMA');tx.objectStore('metadata').put(result);return true;
  });
  const after=await this.frame(b);if(after.url!==f.url){const failure=Error('STORE_UNCONFIRMED',{cause:{stage:'P1_NATIVE_POSTCHECK',rejected_fields:['native_url_sha256']}});await c.invalidate('BFCACHE',b.scope.tab_id,null,null,failure);throw failure;}
  if(p.route){
   const latest=await c.bundle(),current=latest.bindings.find(x=>x.key===b.key);
   if(!current||!this.routeEligible(latest.a,current,p.proof,after.url_sha256,latest.ownerFenceEpoch))fail('UNAUTHORIZED_SENDER');
   for(const [binding,h] of this.handoffs)if(h.expires<=c.now())this.handoffs.delete(binding);
   if(!this.handoffs.has(b.key)&&this.handoffs.size>=128)fail('STORE_CAPACITY');
   // Ephemeral challenge capability only. Original pre-effect proof, operation
   // fingerprint, first response and restoration obligations remain immutable.
   this.handoffs.set(b.key,Object.freeze({id:p.challenge.id,boot:c.boot,profile:c.profile,
    proof_version:p.proof.record_version,scope_hash:values.scope_sha256,sender_hash:values.sender_url_sha256,
    native_hash:after.url_sha256,generation:latest.a.generation,fence_epoch:latest.ownerFenceEpoch,
    transition:latest.a.native_transition.transition_id,expires:latest.a.native_transition.deadline_at}));
  }
  return {id:p.challenge.id,fingerprint:p.fp,status:'ATTESTED'};
 }
 async lease(b,op){
  const c=this.core,pr=await c.store.read(key('NATIVE_BINDING_PROOF',b));if(!pr)return null;checked(pr,'NATIVE_BINDING_PROOF');if(pr.phase!=='ATTESTED')fail('UNAUTHORIZED_SENDER');
  if(pr.creation_boot!==c.boot)await this.attest(b,{revalidate:true});
  const f=await this.frame(b),bundle=await c.bundle(),scopeHash=await digest(b.scope),now=Date.now(),command=structuredClone(op.command);delete command.request_id;
  if(await digest(command)!==op.fingerprint||op.command.payload.operation!=='RELEASE'||op.command.payload.release_mode!=='CLEANUP_ONLY')fail('SCOPE_MISMATCH');
  const l=await c.registry.update((rows,tx)=>{
   const a=rows.find(r=>r.key===bundle.a.key),current=rows.find(r=>r.key===b.key),proof=rows.find(r=>r.key===pr.key),fence=rows.find(r=>r.key==='a1:owner-fence'),original=rows.find(r=>r.key===op.key),prior=rows.find(r=>r.key===key('CLEANUP_LEASE',b));
   if(!a||a.record_version!==bundle.a.record_version||!current||current.record_version!==b.record_version||current.resolution!=='NONE'||proof?.record_version!==pr.record_version||!fence||fence.transitioning||fence.epoch!==bundle.ownerFenceEpoch||fence.owner_context!==a.owner_context||a.profile_epoch!==c.profile||pr.profile!==c.profile)fail('GENERATION_CHANGED');
   if(prior)checked(prior,'CLEANUP_LEASE');
   if(!same(original,op)||op.phase!=='ISSUED'||['EXECUTING','COMPLETED'].includes(prior?.phase))fail('STORE_UNCONFIRMED');
   if(pr.scope_sha256!==scopeHash||pr.origin!==f.origin||!same(current.scope,b.scope)||!same(op.command.payload.scope,b.scope)||op.command.payload.cleanup_authorization_id!==b.cleanup_authorization_id||op.command.owner_context!==b.scope.owner_context)fail('SCOPE_MISMATCH');
   // A transaction-proven ISSUED operation has no durable BEGIN. An aborted
   // write may have left only an ephemeral latch; it is never execution proof.
   // No operation/receipt/credit is deleted or rewound here.
   if(prior)this.live.delete(prior.execution_id);
   current.ordinary_authority='INACTIVE';current.apply_closed=true;current.record_version=uuid();tx.objectStore('metadata').put(current);
   const lease={...base('CLEANUP_LEASE',b),proof_id:pr.proof_id,proof_version:pr.record_version,operation_id:op.operation_id,command_sha256:op.fingerprint,cleanup_authorization_id:b.cleanup_authorization_id,scope_sha256:scopeHash,boot:c.boot,profile:c.profile,generation:a.generation,fence_epoch:fence.epoch,native_url_sha256:f.url_sha256,native_nonce:uuid(),observed_at:now,expires_at:now+15000,phase:'OPEN',execution_id:uuid(),begin_write_id:null,receipt_ids:[]};
   if(!validP1(lease))fail('INVALID_SCHEMA');tx.objectStore('metadata').put(lease);return lease;
  });return l;
 }
 async admission(m,s){
  await this.transitionPending;
  const rows=await this.core.registry.requestRows(m),b=rows.find(r=>r.record_kind==='A1_BINDING'&&r.registration_id===m.payload.registration_id),p=b&&rows.find(r=>r.key===key('NATIVE_BINDING_PROOF',b));if(!p)return null;
  checked(p,'NATIVE_BINDING_PROOF');if(p.phase!=='ATTESTED')denied('UNAUTHORIZED_SENDER','P1_ADMISSION_PROOF',{proof_attested:p.phase==='ATTESTED'});const f=await this.frame(b);
  // Keep the original short-circuit order; diagnostics never trigger an extra
  // native/hash/fetch operation after a failed identity check.
  let senderHash,receiverHash;
  const aggregate=rows.find(r=>r.key==='a1:aggregate:'+b.scope.session_id),ownerFence=rows.find(r=>r.key==='a1:owner-fence'),handoff=this.handoffs.get(b.key);
  const route=this.handoffMatches(handoff,aggregate,b,p,f.url_sha256,ownerFence?.epoch);
  if(s?.id!==this.core.chrome.runtime.id||s.tab?.id!==p.tab_id||s.frameId!==0||s.documentId!==p.document_id||s.documentLifecycle!=='active'||s.origin!==p.origin||f.origin!==p.origin||(senderHash=await rawHash(s.url??''))!==(route?handoff.sender_hash:p.sender_url_sha256)||(receiverHash=await this.core.receiverDigest())!==p.receiver_sha256)denied('UNAUTHORIZED_SENDER','P1_ADMISSION_SENDER',{extension_id:s?.id===this.core.chrome.runtime.id,tab_id:s?.tab?.id===p.tab_id,top_frame:s?.frameId===0,document_id:s?.documentId===p.document_id,lifecycle_active:s?.documentLifecycle==='active',sender_origin:s?.origin===p.origin,native_origin:f.origin===p.origin,sender_url_comparison_performed:senderHash!==undefined,...(senderHash===undefined?{}:{sender_url_equals_registered:senderHash===p.sender_url_sha256}),receiver_bundle_comparison_performed:receiverHash!==undefined,...(receiverHash===undefined?{}:{receiver_bundle_matches:receiverHash===p.receiver_sha256})});
  const a=rows.find(r=>r.key==='a1:aggregate:'+b.scope.session_id),fence=rows.find(r=>r.key==='a1:owner-fence');
  return {f,route_handoff:route?handoff.id:null,binding:b.key,proof_version:p.record_version,scope_hash:await digest(m.payload.scope),credential_hash:await rawHash(m.payload.channel_credential),native_hash:f.url_sha256,at:Date.now(),boot:this.core.boot,aggregate_version:a?.record_version,generation:a?.generation,fence_epoch:fence?.epoch,boot_record_version:rows.find(r=>r.key===key('NATIVE_BOOT_REVALIDATION',b))?.record_version??null,lease_version:rows.find(r=>r.key===key('CLEANUP_LEASE',b))?.record_version??null};
 }
 interruptedApply(ctx,m,rows,b,a){
  // Negative-only completion by the original live actor. No effect, retry,
  // release, new BEGIN or authority renewal is granted by this lane.
  if(!ctx||a.intent==='END'||!this.core.nrPending(a)||a.nr_first_failure||a.native_transition.boot!==this.core.boot||this.core.now()>=a.native_transition.deadline_at)return false;
  const p=rows.find(r=>r.key===key('NATIVE_BINDING_PROOF',b));
  if(!p||p.creation_boot!==this.core.boot||p.profile!==this.core.profile||b.resolution!=='NONE'||ctx.native_hash===p.native_url_sha256&&b.ordinary_authority==='ACTIVE')return false;
  const q=m.payload,ops=rows.filter(o=>o.record_kind==='A1_OPERATION'&&o.binding_id===b.scope.binding_id&&o.phase==='IN_FLIGHT'&&!o.first_response&&o.command.payload.operation==='APPLY');
  if(ops.length!==1)return false;const op=ops[0],live=this.live.get('apply:'+op.operation_id);
  if(!live||live.boot!==this.core.boot||live.binding!==b.scope.binding_id||!rows.some(r=>r.record_kind==='A1_WRITE_RECEIPT'&&r.binding_id===b.scope.binding_id&&r.write_id===live.begin&&r.phase==='COMPLETED'&&r.first_response))return false;
  if(q.action==='READ')return q.selector==='SUMMARY';
  return q.change.kind==='COMPLETE_OPERATION'&&q.change.operation_id===op.operation_id&&q.change.response?.status==='ERROR'&&q.change.response.error?.code==='REVALIDATION_REQUIRED'&&q.change.response.request_id===op.command.request_id;
 }
 guard(ctx,m,rows,b,a,fence,fp){
  const p=rows.find(r=>r.key===key('NATIVE_BINDING_PROOF',b));if(!p){if(ctx)denied('UNAUTHORIZED_SENDER','P1_ATOMIC_GUARD',{guard_1:false});return;}
  checked(p,'NATIVE_BINDING_PROOF');if(!ctx||p.phase!=='ATTESTED'||ctx.binding!==b.key||ctx.proof_version!==p.record_version||p.scope_sha256!==ctx.scope_hash||p.credential_sha256!==ctx.credential_hash||p.fence_epoch!==fence.epoch||p.owner_context!==a.owner_context||p.executor_id!==a.executor_id||p.session_id!==a.session_id||p.profile!==this.core.profile||ctx.boot!==this.core.boot||Date.now()-ctx.at>2000||p.registration_epoch!==b.registration_epoch||p.content_instance!==b.scope.content_instance_id)denied('UNAUTHORIZED_SENDER','P1_ATOMIC_GUARD',{guard_2:false});
  if(ctx.route_handoff&&(!this.handoffMatches(this.handoffs.get(b.key),a,b,p,ctx.native_hash,fence.epoch)||ctx.route_handoff!==this.handoffs.get(b.key)?.id))denied('UNAUTHORIZED_SENDER','P1_ROUTE_HANDOFF',{current_capability:false});
  if(a.record_version!==ctx.aggregate_version||a.generation!==ctx.generation||fence.epoch!==ctx.fence_epoch)fail('STORE_CAS_CONFLICT');
  const l=rows.find(r=>r.key===key('CLEANUP_LEASE',b)),q=m.payload;
  // Exact pair ordinary authority never survives a URL transition, END or boot.
  const requestedOp=q.change?.operation_id&&rows.find(r=>r.record_kind==='A1_OPERATION'&&r.binding_id===b.scope.binding_id&&r.operation_id===q.change.operation_id);
  if(this.core.dom?.guard(ctx,m,rows,b,a,fp))return;
  if(this.interruptedApply(ctx,m,rows,b,a))return;
  // Authenticated status observation only: never grants ledger/effect writes.
  if(q.action==='READ'&&q.selector==='SUMMARY'&&this.core.nrPending(a)&&!a.nr_first_failure&&a.intent!=='END'&&p.creation_boot===this.core.boot&&a.native_transition.boot===this.core.boot&&this.core.now()<a.native_transition.deadline_at&&b.ordinary_authority==='INACTIVE'&&b.apply_closed&&b.resolution==='NONE')return;
  if(requestedOp?.command.payload.operation!=='RELEASE'&&ctx.native_hash===p.native_url_sha256&&b.ordinary_authority==='ACTIVE'&&!b.apply_closed&&a.intent!=='END'&&p.creation_boot===this.core.boot)return;
  checked(l,'CLEANUP_LEASE');const op=rows.find(r=>r.record_kind==='A1_OPERATION'&&r.binding_id===b.scope.binding_id&&r.operation_id===l.operation_id);
  if(l.record_version!==ctx.lease_version||l.proof_id!==p.proof_id||l.proof_version!==p.record_version||l.scope_sha256!==p.scope_sha256||l.owner_context!==p.owner_context||l.executor_id!==p.executor_id||l.session_id!==p.session_id||l.boot!==ctx.boot||l.profile!==p.profile||l.generation!==a.generation||l.fence_epoch!==fence.epoch||l.native_url_sha256!==ctx.native_hash||l.cleanup_authorization_id!==b.cleanup_authorization_id||!op||!valid(op,'operation')||op.fingerprint!==l.command_sha256||op.command.payload.operation!=='RELEASE'||op.command.payload.release_mode!=='CLEANUP_ONLY'||!same(op.command.payload.scope,b.scope)||op.command.payload.cleanup_authorization_id!==b.cleanup_authorization_id||op.command.owner_context!==a.owner_context)denied('UNAUTHORIZED_SENDER','P1_ATOMIC_GUARD',{guard_3:false});
  if(p.creation_boot!==this.core.boot){const r=checked(rows.find(r=>r.key===key('NATIVE_BOOT_REVALIDATION',b)),'NATIVE_BOOT_REVALIDATION');if(r.record_version!==ctx.boot_record_version||r.proof_id!==p.proof_id||r.proof_version!==p.record_version||r.scope_sha256!==p.scope_sha256||r.owner_context!==p.owner_context||r.executor_id!==p.executor_id||r.session_id!==p.session_id||r.boot!==ctx.boot||r.profile!==p.profile||r.generation!==a.generation||r.fence_epoch!==fence.epoch||r.native_url_sha256!==ctx.native_hash)denied('UNAUTHORIZED_SENDER','P1_ATOMIC_GUARD',{guard_4:false});}
  const receipt=q.write_id&&rows.find(r=>r.record_kind==='A1_WRITE_RECEIPT'&&r.binding_id===b.scope.binding_id&&r.write_id===q.write_id);
  if(receipt&&receipt.fingerprint===fp&&l.receipt_ids.includes(q.write_id)&&receipt.phase==='COMPLETED'&&receipt.first_response)return;
  if(l.expires_at<Date.now()||!['OPEN','EXECUTING'].includes(l.phase)||b.resolution!=='NONE'||!b.apply_closed||b.ordinary_authority!=='INACTIVE'||['IN_DOUBT','RESULT_EVICTED'].includes(op.phase))denied('UNAUTHORIZED_SENDER','P1_ATOMIC_GUARD',{guard_5:false});
  if(q.action==='READ'){
   if(['SUMMARY','LEDGER'].includes(q.selector)||q.selector==='OPERATION'&&q.selected_id===l.operation_id||q.selector==='RECEIPT'&&l.receipt_ids.includes(q.selected_id))return;denied('UNAUTHORIZED_SENDER','P1_ATOMIC_GUARD',{guard_6:false});
  }
  if(q.change.operation_id!==l.operation_id)denied('UNAUTHORIZED_SENDER','P1_ATOMIC_GUARD',{guard_7:false});
  if(q.change.kind==='BEGIN_OPERATION'&&op.phase==='ISSUED'&&l.phase==='OPEN')return;
  const live=this.live.get(l.execution_id);
  const beginReceipt=rows.find(r=>r.record_kind==='A1_WRITE_RECEIPT'&&r.binding_id===b.scope.binding_id&&r.write_id===l.begin_write_id&&r.phase==='COMPLETED'&&r.first_response);
  if(q.change.kind==='COMPLETE_OPERATION'&&op.phase==='IN_FLIGHT'&&l.phase==='EXECUTING'&&live?.boot===ctx.boot&&live?.begin===l.begin_write_id&&live?.binding===b.scope.binding_id&&l.receipt_ids.includes(l.begin_write_id)&&beginReceipt)return;
  denied('UNAUTHORIZED_SENDER','P1_ATOMIC_GUARD',{guard_8:false});
 }
 committed(m,rows,b,tx){
  const c=m.payload.change,op=rows.find(r=>r.record_kind==='A1_OPERATION'&&r.binding_id===b.scope.binding_id&&r.operation_id===c.operation_id);if(op?.command.payload.operation==='APPLY'){if(c.kind==='BEGIN_OPERATION')this.live.set('apply:'+op.operation_id,{boot:this.core.boot,binding:b.scope.binding_id,begin:m.payload.write_id});if(c.kind==='COMPLETE_OPERATION')this.live.delete('apply:'+op.operation_id);}
  const l=rows.find(r=>r.key===key('CLEANUP_LEASE',b));if(!l||m.payload.change.operation_id!==l.operation_id)return;
  const q=m.payload;if(q.change.kind==='BEGIN_OPERATION'){l.phase='EXECUTING';l.begin_write_id=q.write_id;this.live.set(l.execution_id,{boot:this.core.boot,binding:b.scope.binding_id,begin:l.begin_write_id});}
  else if(q.change.kind==='COMPLETE_OPERATION'){l.phase='COMPLETED';}
  else fail('UNAUTHORIZED_SENDER');
  l.receipt_ids.push(q.write_id);l.record_version=uuid();if(!validP1(l))fail('INVALID_SCHEMA');tx.objectStore('metadata').put(l);
 }
 async after(ctx,m){
  if(!ctx)return;const b=await this.core.store.read(ctx.binding);let f;try{f=await this.frame(b);}catch{const failure=Error('STORE_UNCONFIRMED',{cause:{stage:'P1_NATIVE_POSTCHECK',rejected_fields:['native_frame']}});await this.core.invalidate('BFCACHE',b.scope.tab_id,null,null,failure);throw failure;}
  if(f.url_sha256!==ctx.native_hash&&!await this.core.nrNativeTransition(b,f)){const failure=Error('STORE_UNCONFIRMED',{cause:{stage:'P1_NATIVE_POSTCHECK',rejected_fields:['native_url_sha256']}});await this.core.invalidate('BFCACHE',b.scope.tab_id,null,null,failure);throw failure;}
  if(m.payload.action==='COMMIT'){
   const l=await this.core.store.read(key('CLEANUP_LEASE',b));if(l?.operation_id===m.payload.change.operation_id){
    if(m.payload.change.kind==='BEGIN_OPERATION')this.live.set(l.execution_id,{boot:this.core.boot,binding:b.scope.binding_id,begin:l.begin_write_id});
    if(m.payload.change.kind==='COMPLETE_OPERATION')this.live.delete(l.execution_id);
   }
  }
 }
 async transitions(bundle){
  for(const b of bundle.bindings.filter(x=>x.resolution==='NONE'&&x.ordinary_authority==='ACTIVE')){
   const p=await this.core.store.read(key('NATIVE_BINDING_PROOF',b));if(!p)continue;checked(p,'NATIVE_BINDING_PROOF');
   let f;try{f=await this.frame(b);}catch(e){let fresh=await this.core.bundle();if(e.message==='UNAUTHORIZED_SENDER'&&e.cause?.stage==='P1_NATIVE_FRAME'&&e.cause?.checks?.native_document_found===false){const retired=await this.core.d1?.committedReplacement(fresh,b);if(retired)return retired;fresh=await this.core.bundle();}if(e.message==='UNAUTHORIZED_SENDER'&&e.cause?.stage==='P1_NATIVE_FRAME'&&e.cause?.checks?.native_document_found===false&&this.core.d1?.replacementPending()&&this.core.nrPending(fresh.a)&&fresh.a.session_id===bundle.a.session_id&&fresh.ownerFenceEpoch===bundle.ownerFenceEpoch){this.core.nrCheck(fresh.a);return fresh;}throw e;}if(p.phase!=='ATTESTED'||f.url_sha256!==p.native_url_sha256){if(p.phase==='ATTESTED'&&await this.core.nrNativeTransition(b,f))return this.core.bundle();await this.core.invalidate('BFCACHE',b.scope.tab_id);return this.core.bundle();}
  }return bundle;
 }
 async refreshExecuting(tabId=null){
  // Core native/END transitions may refresh only an already-running original
  // actor. No BEGIN, dispatch, new operation, credit or expiry extension.
  const c=this.core;
  for(const lease of (await c.registry.rows()).filter(r=>r.record_kind==='CLEANUP_LEASE'&&r.phase==='EXECUTING')){
   try{
    checked(lease,'CLEANUP_LEASE');const live=this.live.get(lease.execution_id),b=await c.store.read('a1:binding:'+lease.binding_id);if(!b||tabId!==null&&b.scope.tab_id!==tabId)continue;
    if(!live||live.boot!==c.boot||live.binding!==b.scope.binding_id||live.begin!==lease.begin_write_id||lease.boot!==c.boot||lease.profile!==c.profile||lease.expires_at<Date.now())continue;
    const originalProof=checked(await c.store.read(key('NATIVE_BINDING_PROOF',b)),'NATIVE_BINDING_PROOF');
    if(originalProof.creation_boot!==c.boot)await this.attest(b,{revalidate:true});
    const f=await this.frame(b),bundle=await c.bundle();await c.registry.update((rows,tx)=>{
     const a=rows.find(r=>r.key===bundle.a.key),l=rows.find(r=>r.key===lease.key),proof=rows.find(r=>r.key===key('NATIVE_BINDING_PROOF',b)),binding=rows.find(r=>r.key===b.key),fence=rows.find(r=>r.key==='a1:owner-fence'),op=rows.find(r=>r.record_kind==='A1_OPERATION'&&r.binding_id===b.scope.binding_id&&r.operation_id===lease.operation_id),receipt=rows.find(r=>r.record_kind==='A1_WRITE_RECEIPT'&&r.binding_id===b.scope.binding_id&&r.write_id===lease.begin_write_id&&r.phase==='COMPLETED'&&r.first_response);
     if(!a||a.record_version!==bundle.a.record_version||!l||l.record_version!==lease.record_version||!binding||binding.record_version!==b.record_version||binding.resolution!=='NONE'||!same(binding.scope,b.scope)||!proof||proof.record_version!==l.proof_version||proof.profile!==c.profile||proof.fence_epoch!==bundle.ownerFenceEpoch||proof.origin!==f.origin||!fence||fence.transitioning||fence.epoch!==lease.fence_epoch||fence.owner_context!==a.owner_context||!op||op.phase!=='IN_FLIGHT'||op.fingerprint!==l.command_sha256||op.command.payload.operation!=='RELEASE'||!same(op.command.payload.scope,b.scope)||!receipt)fail('STORE_CAS_CONFLICT');
     // All native/owner/scope/live-BEGIN guards above still run. An unchanged
     // observation grants no new authority and must not invalidate a concurrent
     // original COMPLETE context by changing only the lease version/nonce.
     if(l.generation===a.generation&&l.native_url_sha256===f.url_sha256)return true;
     l.generation=a.generation;l.native_url_sha256=f.url_sha256;l.native_nonce=uuid();l.observed_at=Date.now();l.record_version=uuid();if(!validP1(l))fail('INVALID_SCHEMA');tx.objectStore('metadata').put(l);return true;
    });
   }catch{/* Any uncertain refresh leaves the old lease unextended and debt intact. */}
  }
 }
}

// Called only from the packaged receiver listener. Private config never enters
// a page-visible facade. Actual Chrome supplies MessageSender on the response.
export async function respondProbe(m,s,runtime,config){
 if(!workerSender(s,runtime)||!m||!same(Object.keys(m).sort(),['type','challenge','fingerprint'].sort())||m.type!=='D06_MEMBER_P1_PROBE'||!m.challenge||!same(Object.keys(m.challenge).sort(),['id','nonce','binding','registration','epoch','boot'].sort())||Object.values(m.challenge).some(x=>typeof x!=='string'||!x)||m.challenge.binding!==config.scope.binding_id||m.challenge.registration!==config.registration_id||m.challenge.epoch!==config.registration_epoch||await digest(m.challenge)!==m.fingerprint)fail('UNAUTHORIZED_SENDER');
 return runtime.sendMessage({type:'D06_MEMBER_P1_ATTEST',challenge:m.challenge,fingerprint:m.fingerprint,scope:config.scope,registration_id:config.registration_id,registration_epoch:config.registration_epoch,credential:config.channel_credential});
}
