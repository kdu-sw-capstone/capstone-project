import {VERSION,valid,same,fail,digest,effectConfirmed,releaseConfirmed} from './contract.mjs';
import {id,instant,error,coverageConfirmed,invalidateAggregate} from './domain.mjs';
const copy=structuredClone,opkey=(b,o)=>'a1:operation:'+b+':'+o,writekey=(b,w)=>'a1:receipt:'+b+':'+w;
export class A1Registry {
 constructor(store,chrome,{onChange=()=>{}}={}){this.store=store;this.chrome=chrome;this.onChange=onChange;this.queues=new Map();this.proofs=new Map();}
 rows(){return this.store.db.transaction('readonly',(tx,done)=>{const q=tx.objectStore('metadata').getAll();q.onsuccess=()=>done(q.result);});}
 update(work,binding=null){return this.store.atomic((tx,done,reject)=>{
  const md=tx.objectStore('metadata'),apply=rows=>{try{done(copy(work(rows,tx)));}catch(e){reject(e);}};
  if(!binding){const q=md.getAll();q.onsuccess=()=>apply(q.result);return;}
  // Only issue/COMMIT use this selection. All guards, FIFO entries, credits,
  // cleanup proofs, and DOM proofs they inspect remain in the same RW snapshot.
  const bid=binding.scope.binding_id,sid=binding.scope.session_id,q=md.getAllKeys();q.onsuccess=()=>{
   const keys=q.result.filter(k=>typeof k==='string'&&(k===binding.key||k==='a1:aggregate:'+sid||k==='a1:owner-fence'||k==='member:admission:'+sid||k.startsWith('a1:operation:'+bid+':')||k.startsWith('a1:receipt:'+bid+':')||k.startsWith('a1:dom:')||k.startsWith('a1:p1:')&&k.endsWith(':'+bid))),rows=[];let pending=keys.length;if(!pending){apply(rows);return;}
   for(const key of keys){const get=md.get(key);get.onsuccess=()=>{if(get.result)rows.push(get.result);if(!--pending){rows.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);apply(rows);}};}
  };
 });}
 // One readonly snapshot of the request's exact Binding and authority records.
 // Unrelated historical receipts/operations are neither loaded nor rewritten.
 // The same native/P1/Scope/Fence/UUID guards below still decide authorization.
 async requestRows(m,work=null){
  const p=m.payload,b=p.scope.binding_id,keys=['a1:binding:'+b,'a1:aggregate:'+p.scope.session_id,'a1:owner-fence',...['NATIVE_BINDING_PROOF','NATIVE_BOOT_REVALIDATION','CLEANUP_LEASE'].map(kind=>'a1:p1:'+kind+':'+b)];
  if(p.action==='READ'&&p.selector==='SUMMARY')for(const [id,live] of this.p1?.live??[]){if(id.startsWith('apply:')&&live.binding===b&&live.boot===this.p1.core.boot){keys.push(opkey(b,id.slice(6)),writekey(b,live.begin));}}
  if(p.action==='READ'&&p.selector==='OPERATION')keys.push(opkey(b,p.selected_id));
  if(p.action==='READ'&&p.selector==='RECEIPT')keys.push(writekey(b,p.selected_id));
  let reason;try{return await this.store.db.transaction('readonly',(tx,done)=>{
   const md=tx.objectStore('metadata'),seen=new Set(),rows=[];let pending=0;
   const get=k=>{if(seen.has(k))return;seen.add(k);pending++;const q=md.get(k);q.onsuccess=()=>{
    const r=q.result;if(r)rows.push(r);
    if(r?.key==='a1:p1:CLEANUP_LEASE:'+b){
     // Malformed records receive no unbounded fanout. The unchanged P1 guard
     // must reject them; absent evidence can never authorize a request.
     if(typeof r.operation_id==='string'&&r.operation_id.length<=36)get(opkey(b,r.operation_id));
     if(typeof r.begin_write_id==='string'&&r.begin_write_id.length<=36)get(writekey(b,r.begin_write_id));
     if(Array.isArray(r.receipt_ids)&&r.receipt_ids.length<=2)for(const id of r.receipt_ids)if(typeof id==='string'&&id.length<=36)get(writekey(b,id));
    }
    if(--pending===0)try{done(work?copy(work(rows,tx)):rows);}catch(e){reason=e;tx.abort();}
   };};for(const k of keys)get(k);
  });}catch(e){throw reason??e;}
 }
 readOnly(work,m){return this.requestRows(m,work);}
 async issue(b,m,{reuseCleanup=false,ownerFenceEpoch=null,selectedOperationId=null,aggregateRecordVersion=null}={}){const original=copy(m);delete original.request_id;const fp=await digest(original);return this.update((rows,tx)=>{
  const current=rows.find(r=>r.key===b.key),a=rows.find(r=>r.key==='a1:aggregate:'+b.scope.session_id);if(!current||!a||!valid(m,'control_request')||!same(m.payload.scope,current.scope)||m.owner_context!==a.owner_context)fail('SCOPE_MISMATCH');
  if(reuseCleanup){
   const fence=rows.find(r=>r.key==='a1:owner-fence');
   if(!fence||fence.transitioning||fence.owner_context!==a.owner_context||fence.epoch!==ownerFenceEpoch)fail('OWNER_MISMATCH');
   if(m.payload.operation!=='RELEASE'||m.payload.applied_binding_id!==current.scope.binding_id||m.payload.cleanup_authorization_id!==current.cleanup_authorization_id)fail('SCOPE_MISMATCH');
   // Select inside the admission transaction: concurrent status checks cannot
   // reserve a second command for the same unresolved restoration obligation.
   const releases=rows.filter(r=>r.record_kind==='A1_OPERATION'&&r.binding_id===current.scope.binding_id&&r.command.payload.operation==='RELEASE');
   const pending=releases.filter(r=>r.phase!=='COMPLETED');
   if(selectedOperationId!==null){
    if(a.record_version!==aggregateRecordVersion)fail('GENERATION_CHANGED');
    if(current.record_version!==b.record_version)fail('STORE_CAS_CONFLICT');
    if(current.resolution!=='NONE'||current.ordinary_authority==='REVOKED'||current.readiness!=='READY')fail('INACTIVE_SCOPE');
    if(pending.some(o=>o.phase!=='ISSUED'))fail('STORE_UNCONFIRMED');
    // Explicit recovery needs both BEGIN and durable COMPLETE capacity before
    // any media/DOM restoration; operation credit is already reserved.
    if(current.cleanup_reservation.remaining_writes<2)fail('CLEANUP_BUDGET_EXHAUSTED');
   }else if(pending.length>1)fail('STORE_UNCONFIRMED');
   const prior=selectedOperationId!==null?pending.find(o=>o.operation_id===selectedOperationId):pending[0]??releases.at(-1);
   if(selectedOperationId!==null&&!prior)fail('STORE_UNKNOWN_OPERATION');
   if(prior){
    if(!valid(prior,'operation')||!prior.cleanup_slot||prior.binding_id!==current.scope.binding_id||prior.scope_epoch!==current.scope.scope_epoch||!same(prior.command.payload.scope,current.scope)||prior.command.owner_context!==a.owner_context||prior.command.payload.applied_binding_id!==current.scope.binding_id||prior.command.payload.cleanup_authorization_id!==current.cleanup_authorization_id)fail('SCOPE_MISMATCH');
    return prior;
   }
  }
  const key=opkey(b.scope.binding_id,m.payload.operation_id),prior=rows.find(r=>r.key===key);if(prior){if(prior.fingerprint!==fp)fail('OPERATION_CONFLICT');return prior;}
  if(['ENDED','START_FAILED'].includes(a.session_status))fail('INACTIVE_SCOPE');
  const p=m.payload,cleanup=p.operation==='RELEASE';if(p.command_revision!==a.desired_revision)fail('STALE_SESSION_REVISION');
  // A verified pending DOM grant owns this inactive binding. No QUERY is
  // issued here; abort and let Core obtain fresh transition evidence.
  if(p.operation==='QUERY'&&this.dom?.pending(a)&&current.ordinary_authority==='INACTIVE'&&!current.apply_closed&&current.resolution==='NONE')fail('STALE_AGGREGATE');
  // Existing-ID replay above remains immutable; only fresh application is capped.
  if(p.operation==='APPLY'&&a.session_status==='EFFECT_VERIFYING')fail('INACTIVE_SCOPE');if(p.operation==='APPLY'&&(a.generation===Number.MAX_SAFE_INTEGER||a.session_revision===Number.MAX_SAFE_INTEGER||a.desired_revision===Number.MAX_SAFE_INTEGER))fail('INVALID_TRANSITION');
  if(p.operation==='APPLY'&&(a.intent==='END'||current.ordinary_authority!=='ACTIVE'||current.apply_closed||!same(p.projection,current.projection)||p.cleanup_authorization_id!==current.cleanup_authorization_id))fail('INACTIVE_SCOPE');
  if(cleanup&&(p.applied_binding_id!==current.scope.binding_id||p.cleanup_authorization_id!==current.cleanup_authorization_id))fail('SCOPE_MISMATCH');
  if(p.operation!=='QUERY'&&p.release_mode!=='CLEANUP_ONLY'&&p.control_seq<=current.control_seq)fail('STALE_CONTROL');
  const own=rows.filter(r=>r.record_kind==='A1_OPERATION'&&r.binding_id===current.scope.binding_id);
  if(!cleanup&&own.filter(r=>!r.cleanup_slot).length>=256)fail('STORE_CAPACITY');
  if(cleanup){if(current.cleanup_reservation.remaining_operations<1)fail('CLEANUP_BUDGET_EXHAUSTED');current.cleanup_reservation.remaining_operations--;current.record_version=id();tx.objectStore('metadata').put(current);}
  const record={record_kind:'A1_OPERATION',schema_version:VERSION,key,operation_id:p.operation_id,binding_id:b.scope.binding_id,scope_epoch:b.scope.scope_epoch,command_revision:p.command_revision,command:copy(m),fingerprint:fp,phase:'ISSUED',cleanup_slot:cleanup,first_response:null};if(!valid(record,'operation'))fail('INVALID_SCHEMA');tx.objectStore('metadata').add(record);return record;
 },b);}
 async ready(b){return this.update((rows,tx)=>{const row=rows.find(r=>r.key===b.key);if(!row||row.readiness!=='PROVISIONAL'||row.ordinary_authority==='REVOKED'||!same(row.scope,b.scope)||row.registration_id!==b.registration_id||row.registration_epoch!==b.registration_epoch||row.channel_credential!==b.channel_credential)fail('INACTIVE_SCOPE');row.readiness='READY';row.record_version=id();tx.objectStore('metadata').put(row);return row;});}
 async native(m,s){const p=m.payload,deny=(code,stage,checks)=>{throw new Error(code,{cause:{stage,checks}});};
  const senderChecks={extension_id:s?.id===this.chrome.runtime.id,top_frame:s?.frameId===0,tab_id:Number.isInteger(s?.tab?.id),document_id:!!s?.documentId,lifecycle:['active','cached'].includes(s?.documentLifecycle)};
  if(Object.values(senderChecks).some(x=>!x))deny('UNAUTHORIZED_SENDER','REGISTRY_NATIVE_SENDER',senderChecks);
  const ctx=await this.p1?.admission(m,s);if(ctx)return {...ctx.f,p1_context:ctx};
  const frames=await this.chrome.webNavigation.getAllFrames({tabId:s.tab.id}),f=frames.find(x=>x.frameId===0&&x.documentId===s.documentId),documentChecks={native_document_found:!!f,sender_url_equals_current:!!f&&f.url===s.url,lifecycle_equals_current:!!f&&f.documentLifecycle===s.documentLifecycle};
  if(Object.values(documentChecks).some(x=>!x))deny('UNAUTHORIZED_SENDER','REGISTRY_NATIVE_DOCUMENT',documentChecks);
  const u=new URL(f.url),scopeChecks={https:u.protocol==='https:',supported_host:['youtube.com','www.youtube.com'].includes(u.hostname),native_origin:s.origin===u.origin,scope_tab:p.scope.tab_id===s.tab.id,scope_document:p.scope.document_id===s.documentId,scope_host:p.scope.target_host===u.hostname};
  if(Object.values(scopeChecks).some(x=>!x))deny('SCOPE_MISMATCH','REGISTRY_NATIVE_SCOPE',scopeChecks);return f;
 }
 summary(b,ops,a=null){const latest=b.resolution==='RELEASE_VERIFIED'?'RELEASED':b.ordinary_authority!=='ACTIVE'?'UNCONFIRMED':effectConfirmed(b.current_effect)?'APPLIED':coverageConfirmed(b.current_coverage)?b.current_coverage.candidate_count?'COVERED':'NOT_APPLICABLE':b.cleanup_pending?'OBSERVING':b.readiness==='READY'?'ADAPTER_READY':'UNCONFIRMED';return {view:'SUMMARY',dom_cap:this.dom?.pending(a)&&this.dom.grant(a,b)?this.dom.cap(a.effect_transition,this.dom.grant(a,b)):null,readiness:b.readiness,lifecycle:b.native_lifecycle==='GONE'?'GONE':b.ordinary_authority==='ACTIVE'?'ACTIVE':'INACTIVE',cleanup_pending:b.cleanup_pending,control_seq:b.control_seq,current_result:latest};}
 // Called only inside the already authenticated mutation transaction.
 // Diagnostic-request failure is isolated; ordinary ledger errors still abort.
 recordInvalidationDiagnostic(rows,tx,a,session,cause){
  if(a.session_status==='UNKNOWN'||a.nr_first_failure||a.intent==='END'||rows.some(r=>r.key==='member:first-failure:'+a.session_id))return null;
  const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
  if(session.owner_key!==a.owner_context||session.executor_id!==a.executor_id||!uuid(session.start_request_id)||!uuid(a.session_id)||!uuid(a.executor_id)||!Number.isSafeInteger(a.generation))return null;
  const codes=['BFCACHE','RESPONSE_UNCONFIRMED','INACTIVE_SCOPE','STORE_UNCONFIRMED','UNAUTHORIZED_SENDER','OWNER_MISMATCH','SCOPE_MISMATCH','INVALID_EFFECT_EVIDENCE','INVALID_CURRENT_RESPONSE','REVALIDATION_REQUIRED'];
  const code=codes.includes(cause)?cause:'UNCLASSIFIED_FAILURE',note={failed:false};
  try{const row={key:'member:first-failure:'+a.session_id,contract:'MEMBER_FIRST_FAILURE_1',session_id:a.session_id,owner_key:a.owner_context,executor_id:a.executor_id,request_id:session.start_request_id,generation:a.generation,transition_id:a.native_transition?.transition_id??null,at_epoch_ms:Date.now(),diagnostic:{version:'MEMBER_LOCAL_DIAGNOSTIC_1',code,stage:'REGISTRY_INVALIDATE',rejected_fields:[],authority_granted:false},authority_granted:false};
   const write=tx.objectStore('metadata').add(row);write.onerror=event=>{note.failed=true;event.preventDefault();event.stopPropagation();};
  }catch{note.failed=true;}
  return note;
 }
 async handle(m,s){if(!valid(m,'storage_request'))return error(m?.request_id??id(),'INVALID_SCHEMA');if(new TextEncoder().encode(JSON.stringify(m)).length>262144)return error(m.request_id,'STORE_CAPACITY');
  let queue,slot,queued=false,domAdmitted=false,diagnosticWrite=null;try{await this.dom?.expire();const planHash=m.payload.change?.kind==='LEDGER_PLAN'?await digest(m.payload.change.entries):null;let f=await this.native(m,s);const p=m.payload,original=copy(m);delete original.request_id;const fp=await digest(original);const initial=await this.store.read('a1:binding:'+p.scope.binding_id);if(!initial||initial.record_kind!=='A1_BINDING'||initial.registration_id!==p.registration_id)fail('SCOPE_MISMATCH');const operation=p.change?.operation_id;const issued=operation?await this.store.read(opkey(initial.scope.binding_id,operation)):null;slot=issued?.cleanup_slot?'cleanup':'normal';queue=this.queues.get(p.registration_id)??{normal:0,cleanup:0};if(queue[slot]>=(slot==='cleanup'?8:32))fail('STORE_CAPACITY');queue[slot]++;queued=true;this.queues.set(p.registration_id,queue);
   if(p.action==='COMMIT'&&p.change?.kind==='LEDGER_PLAN'&&this.dom?.core.runningConfirmationPending){await this.dom.core.waitRunningConfirmation();f=await this.native(m,s);}
   // Preparation above is read-only. If it consumed this native observation's
   // lifetime, observe/authenticate the SAME request once before opening the
   // mutation transaction. No guard/write/dispatch is retried and the original
   // 2second atomic freshness check remains mandatory below.
   if(f.p1_context&&Date.now()-f.p1_context.at>2000)f=await this.native(m,s);
   const transact=p.action==='READ'?(work=>this.readOnly(work,m)):(work=>this.update(work,initial));
   const result=await transact((rows,tx)=>{
    const b=rows.find(x=>x.key===initial.key),a=rows.find(x=>x.key==='a1:aggregate:'+initial.scope.session_id),fence=rows.find(x=>x.key==='a1:owner-fence');
    if(!b||!a||!fence||fence.owner_context!==a.owner_context||fence.transitioning||m.owner_context!==a.owner_context||!same(p.scope,b.scope)||p.registration_epoch!==b.registration_epoch||p.channel_credential!==b.channel_credential)fail('SCOPE_MISMATCH');
    if(this.dom?.pending(a)&&p.action==='COMMIT'&&['LEDGER_PLAN','DOM_CONFIRM'].includes(p.change.kind)&&this.dom.grant(a,b)?.native_hash===f.p1_context?.native_hash)domAdmitted=true;this.p1?.guard(f.p1_context,m,rows,b,a,fence,fp);
    const own=rows.filter(r=>r.record_kind==='A1_OPERATION'&&r.binding_id===b.scope.binding_id);const response=(view,action,write_id=null,receipt_id=null)=>({request_id:m.request_id,status:'OK',data:{protocol_version:VERSION,family:'STORAGE',registration_id:b.registration_id,registration_epoch:b.registration_epoch,record_version:b.record_version,action,write_id,receipt_id,view},error:null});
    if(p.action==='READ'){
     let view;if(p.selector==='SUMMARY'){view=this.summary(b,own,a);if(this.p1?.interruptedApply(f.p1_context,m,rows,b,a))view.lifecycle='INACTIVE';}else if(p.selector==='LEDGER')view={view:'LEDGER',entries:copy(b.ledger)};else {const selected=rows.find(r=>r.key===(p.selector==='OPERATION'?opkey(b.scope.binding_id,p.selected_id):writekey(b.scope.binding_id,p.selected_id)));if(!selected)fail(p.selector==='OPERATION'?'STORE_UNKNOWN_OPERATION':'STORE_UNKNOWN_WRITE');view={view:p.selector,selected_id:p.selected_id,phase:selected.phase,first_response:copy(selected.first_response)};}
     // ISSUED is an internal record phase, absent from the approved wire view.
     // Report no confirmed result; never invent IN_FLIGHT or a success response.
     if(p.selector==='OPERATION'&&view.phase==='ISSUED')fail('STORE_UNCONFIRMED');
     const r=response(view,'READ');if(!valid(r,'read_result'))fail('INVALID_CURRENT_RESPONSE');return r;
    }
    const key=writekey(b.scope.binding_id,p.write_id),prior=rows.find(x=>x.key===key);if(prior){if(prior.fingerprint!==fp)fail('STORE_WRITE_CONFLICT');if(!prior.first_response)fail('STORE_RESULT_EVICTED');return {...copy(prior.first_response),request_id:m.request_id};}
    if(['ENDED','START_FAILED'].includes(a.session_status))fail('INACTIVE_SCOPE');
    if(b.record_version!==p.expected_record_version)fail('STORE_CAS_CONFLICT');
    const c=p.change,op=c.operation_id?own.find(o=>o.operation_id===c.operation_id):null,cleanup=!!op?.cleanup_slot;domAdmitted ||=a.dom_transition_contract==='DP01_1'&&a.intent!=='END'&&op?.command.payload.operation==='APPLY'&&['LEDGER_PLAN','DOM_CONFIRM'].includes(c.kind);
    if(c.kind!=='INVALIDATE'&&!op)fail('STORE_UNKNOWN_OPERATION');
    if(c.kind!=='INVALIDATE'&&!cleanup&&!this.p1?.interruptedApply(f.p1_context,m,rows,b,a)&&(a.intent==='END'||b.ordinary_authority!=='ACTIVE'&&!this.dom?.guard(f.p1_context,m,rows,b,a,fp)||f.documentLifecycle!=='active'))fail('INACTIVE_SCOPE');
    if(b.readiness!=='READY'&&c.kind!=='INVALIDATE')fail('INACTIVE_SCOPE');
    const receipts=rows.filter(r=>r.record_kind==='A1_WRITE_RECEIPT'&&r.binding_id===b.scope.binding_id);
    if(cleanup){if(b.cleanup_reservation.remaining_writes<1)fail('CLEANUP_BUDGET_EXHAUSTED');b.cleanup_reservation.remaining_writes--;}else if(receipts.filter(r=>!r.cleanup_slot).length+rows.filter(r=>r.record_kind==='DOM_EFFECT_PROOF'&&r.binding_id===b.scope.binding_id).length+(a.dom_transition_contract==='DP01_1'&&(c.kind==='DOM_CONFIRM'||c.kind==='LEDGER_PLAN'&&c.entries.length>b.ledger.length)?1:0)+(rows.some(r=>r.record_kind==='NATIVE_BINDING_PROOF'&&r.binding_id===b.scope.binding_id)?3:0)>=1024)fail('STORE_CAPACITY');
    const sessionReq=tx.objectStore('sessions').get([a.owner_context,a.session_id]),journalReq=tx.objectStore('journal').get([a.owner_context,a.session_id]);
    const invalidate=()=>{sessionReq.onsuccess=()=>{journalReq.onsuccess=()=>{if(sessionReq.result&&journalReq.result){diagnosticWrite=this.recordInvalidationDiagnostic(rows,tx,a,sessionReq.result,c.kind==='COMPLETE_OPERATION'&&c.response?.status==='ERROR'?c.response.error.code:c.kind==='INVALIDATE'&&c.reason==='PAGEHIDE'?'BFCACHE':'RESPONSE_UNCONFIRMED');invalidateAggregate(a,sessionReq.result,journalReq.result,tx,c.kind==='INVALIDATE'&&c.reason==='PAGEHIDE'?'BFCACHE':'RESPONSE_UNCONFIRMED');}else tx.abort();};};};
    if(c.kind==='BEGIN_OPERATION'){
     if(op.phase!=='ISSUED')fail('OPERATION_CONFLICT');const control=op.command.payload;
     // A first result/receipt replay remains available above. It grants no
     // fresh mutation after the binding has already discharged its obligation.
     if(cleanup&&(b.resolution!=='NONE'||b.ordinary_authority==='REVOKED'))fail('INACTIVE_SCOPE');
     if(cleanup&&own.some(other=>other.operation_id!==op.operation_id&&other.cleanup_slot&&['IN_FLIGHT','IN_DOUBT'].includes(other.phase)))fail('STORE_UNCONFIRMED');
     if(control.operation==='APPLY'){if(b.apply_closed||b.cleanup_pending)fail('CLEANUP_REQUIRED');b.cleanup_pending=true;}
     if(control.operation==='RELEASE')b.apply_closed=true;
     if(control.control_seq!==undefined&&control.control_seq!==null){if(control.control_seq<=b.control_seq)fail('STALE_CONTROL');b.control_seq=control.control_seq;}
     op.phase='IN_FLIGHT';
    }else if(c.kind==='LEDGER_PLAN'){
     if(op.command.payload.operation!=='APPLY'||!['IN_FLIGHT','COMPLETED'].includes(op.phase)||b.apply_closed)fail('INVALID_TRANSITION');
     if(a.dom_transition_contract==='DP01_1'&&!same(c.entries.slice(0,b.ledger.length),b.ledger))fail('INVALID_TRANSITION');for(const e of b.ledger)if(!c.entries.some(x=>same(x,e)))fail('INVALID_TRANSITION');
     if(new Set(c.entries.map(x=>x.node_id)).size!==c.entries.length)fail('INVALID_SCHEMA');
     if(c.entries.length>b.ledger.length&&['RUNNING','EFFECT_VERIFYING'].includes(a.session_status)){if(this.dom&&a.dom_transition_contract==='DP01_1')this.dom.enter(rows,tx,a,b,op,m,f.p1_context,planHash,sessionReq,journalReq);else invalidate();}b.ledger=copy(c.entries);
    }else if(c.kind==='COMPLETE_OPERATION'){
     const r=c.response,payload=op.command.payload;if(op.phase!=='IN_FLIGHT'||r.request_id!==op.command.request_id||r.status==='OK'&&(r.data.operation_id!==op.operation_id||r.data.operation!==payload.operation||!same(r.data.scope,b.scope)))fail('INVALID_CURRENT_RESPONSE');
     if(r.status==='OK'){
      const d=r.data;if(d.result_state==='APPLIED'&&!effectConfirmed(d.effect_evidence)||['COVERED','NOT_APPLICABLE'].includes(d.result_state)&&(!coverageConfirmed(d.coverage_evidence)||(d.result_state==='NOT_APPLICABLE'&&d.coverage_evidence.candidate_count!==0)))fail('INVALID_EFFECT_EVIDENCE');
      if(d.result_state==='RELEASED'){
       if(!cleanup||!releaseConfirmed(d.release_evidence))fail('INVALID_RELEASE_EVIDENCE');b.ledger=[];b.cleanup_pending=false;b.resolution='RELEASE_VERIFIED';b.ordinary_authority='REVOKED';b.release_evidence=copy(d.release_evidence);
      }else if(cleanup){b.cleanup_pending=true;b.release_evidence=copy(d.release_evidence);}else{
       b.current_effect=copy(d.effect_evidence);b.current_coverage=copy(d.coverage_evidence);b.evidence_generation=a.generation;if(payload.round_id)b.evidence_round_id=payload.round_id;
       if(a.session_status==='RUNNING'&&!effectConfirmed(b.current_effect)&&!coverageConfirmed(b.current_coverage))invalidate();
      }
     }else if(a.session_status==='RUNNING')invalidate();
     op.phase='COMPLETED';op.first_response=copy(r);tx.objectStore('metadata').put(op);
     const fifo=[...own.filter(x=>x.operation_id!==op.operation_id&&!x.cleanup_slot&&x.first_response),...(!op.cleanup_slot?[op]:[])];while(fifo.length>64){const e=fifo.shift();e.first_response=null;e.phase='RESULT_EVICTED';tx.objectStore('metadata').put(e);}
    }else if(c.kind==='DOM_CONFIRM'){if(!this.dom?.pending(a))fail('INVALID_TRANSITION');this.dom.confirm(a,b,c,op,tx);tx.objectStore('metadata').put(a);
    }else if(c.kind==='CHECKPOINT'){
     if(op.command.payload.operation!=='APPLY'||op.phase!=='COMPLETED'||b.apply_closed||c.round_id!==op.command.payload.round_id||b.evidence_round_id!==c.round_id)fail('STALE_CONTROL');b.current_effect=copy(c.effect_evidence);b.current_coverage=copy(c.coverage_evidence);b.evidence_generation=a.generation;if(a.session_status==='RUNNING'&&!effectConfirmed(b.current_effect)&&!coverageConfirmed(b.current_coverage))invalidate();
    }else{b.ordinary_authority='INACTIVE';b.native_lifecycle=f.documentLifecycle==='cached'?'CACHED':'UNCONFIRMED';b.apply_closed=true;invalidate();}
    b.record_version=id();if(!valid(b,'binding'))fail('INVALID_TRANSITION_STATE');tx.objectStore('metadata').put(b);if(op)tx.objectStore('metadata').put(op);
    const r=response(this.summary(b,[...own.filter(x=>x.operation_id!==op?.operation_id),...(op?[op]:[])],a),'COMMIT',p.write_id,id());if(!valid(r,'write_result'))fail('INVALID_CURRENT_RESPONSE');
    const receipt={record_kind:'A1_WRITE_RECEIPT',schema_version:VERSION,key,write_id:p.write_id,binding_id:b.scope.binding_id,scope_epoch:b.scope.scope_epoch,fingerprint:fp,committed_record_version:b.record_version,cleanup_slot:cleanup,phase:'COMPLETED',first_response:copy(r)};if(!valid(receipt,'receipt'))fail('INVALID_CURRENT_RESPONSE');tx.objectStore('metadata').add(receipt);this.p1?.committed(m,rows,b,tx);
    const normal=receipts.filter(x=>!x.cleanup_slot&&x.first_response);if(!cleanup)normal.push(receipt);while(normal.length>128){const e=normal.shift();e.first_response=null;e.phase='RESULT_EVICTED';tx.objectStore('metadata').put(e);}return r;
   });if(diagnosticWrite)this.firstFailurePersistence=diagnosticWrite.failed?'UNCONFIRMED':'COMMIT_ACKNOWLEDGED';await this.p1?.after(f.p1_context,m);if(p.action==='COMMIT')await this.dom?.after(m);if(p.action==='COMMIT'){if(['COMPLETE_OPERATION','CHECKPOINT','DOM_CONFIRM'].includes(p.change.kind))this.proofs.set(initial.scope.binding_id,{at:Date.now()});if(['INVALIDATE','LEDGER_PLAN'].includes(p.change.kind))this.onChange();}return result;
  }catch(e){if(diagnosticWrite)this.firstFailurePersistence='UNCONFIRMED';if(domAdmitted&&['STORE_CAPACITY','STORE_UNCONFIRMED','INVALID_EFFECT_EVIDENCE','UNAUTHORIZED_SENDER'].includes(e.message)){try{await this.dom.core.markUnknown(e.message);}catch{}}if(['UNAUTHORIZED_SENDER','SCOPE_MISMATCH','OWNER_MISMATCH'].includes(e.message)){
    // Diagnostics stay in Worker memory; no wire/schema/storage or authority change.
    // Emit only static stage names and boolean checks, never URL/IDs/credential/body.
    const diagnostic={captured_at:instant(),code:e.message,stage:e.cause?.stage??'REGISTRY_UNCLASSIFIED',checks:e.cause?.checks??{}};
    this.firstRejection??=diagnostic;this.lastRejection=diagnostic;console.error('FOCURVE_MEMBER_A1_STORAGE_REJECTED',JSON.stringify(diagnostic));
   }return error(m.request_id,e.message,['STORE_UNCONFIRMED'].includes(e.message)||(m.payload?.action==='READ'&&e.message==='STORE_CAS_CONFLICT'));}finally{if(queued)queue[slot]--;}
 }
}
