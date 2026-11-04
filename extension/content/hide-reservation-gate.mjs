// Internal opt-in scheduling seam only. A callback ACK is NOT a Core capability,
// CleanupGrant, ContentResult or Server receipt. No runtime listener/storage.
import {canonical,freezeCopy,localDigest,boundContext} from './local-evidence.mjs';
export class HideReservationGate {
  #ledger;#reserve;#generation;#refresh;#timeout;#closed=false;
  #records=new Map();#issued=[];
  #boundGeneration;#documentInstance=crypto.randomUUID();
  #maxPlans;
  #context;#originalContextScope;#verifyContext;#verifyCompletion;#contextMode;#contextHash;#gateId=crypto.randomUUID();
  // Instance-local fence only; not a Core/provider authority or public token.
  #cleanupRevision=0n;
  #lifetimeRecords;
  constructor(ledger,{reserve,getGeneration,timeoutMs=5000,maxPlans=256,context,verifyContext,verifyCompletion,localLifetime}={},refresh=()=>{},owner={}) {
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw Error('INVALID_RESERVATION_TIMEOUT');
    if(!Number.isSafeInteger(maxPlans)||maxPlans<1||maxPlans>4096)throw Error('INVALID_RESERVATION_CAPACITY');
    this.#ledger=ledger;this.#reserve=reserve;this.#generation=getGeneration;this.#refresh=refresh;this.#timeout=timeoutMs;
    this.#lifetimeRecords=localLifetime;
    this.#boundGeneration=this.#epoch();
    this.#maxPlans=maxPlans;
    this.#contextMode=context!==undefined;this.#verifyContext=verifyContext;this.#verifyCompletion=verifyCompletion;
    if(this.#contextMode){
      try{this.#context=boundContext(context,owner,this.#boundGeneration);}catch{this.#context=null;}
    }
    this.#originalContextScope=this.#context?.scope??null;
    const contextHash=()=>this.#context?localDigest(this.#context).catch(()=>{this.#context=null;return null;}):Promise.resolve(null);
    this.#contextHash=this.#lifetimeRecords?this.#lifetimeRecords.run('gate.context_hash',contextHash):contextHash();
  }
  #epoch(){try{const v=this.#generation?.();if(v&&typeof v.then==='function')Promise.resolve(v).catch(()=>{});
    return Number.isSafeInteger(v)&&v>0?v:null;}catch{return null;}}
  #current(check){try{const v=check();if(v&&typeof v.then==='function')Promise.resolve(v).catch(()=>{});return v===true;}catch{return false;}}
  #validContext(){return !this.#contextMode||!!this.#context&&this.#current(()=>this.#verifyContext?.(this.#context));}
  hide(claim,element,current) {
    if(this.#closed||!this.#validContext()||!this.#current(current)||this.#boundGeneration===null)return false;
    if(this.#epoch()!==this.#boundGeneration){this.close();return false;}
    let record=this.#records.get(claim);
    if(record?.state==='APPLIED'&&this.#ledger.isHiddenBy(claim,element,record.plan))return true;
    if(record?.state==='READY'){
      if(this.#epoch()!==record.generation){record.state='STALE';return false;}
      const applied=this.#ledger.applyHidePlan(record.plan,element,()=>!this.#closed&&this.#validContext()&&this.#epoch()===record.generation&&this.#current(current));
      if(applied!==null){record.state=applied?'APPLIED':'FAILED';return applied;}
      record.state='STALE';record=null;
    }
    if(record&&record.state!=='APPLIED')return record.state==='PENDING'?null:false;
    if(typeof this.#reserve!=='function'||this.#issued.length>=this.#maxPlans)return false;
    let plan;try{plan=this.#ledger.planHide(claim,element);}catch{return false;}
    record={plan,local_plan_id:crypto.randomUUID(),generation:this.#epoch(),state:'PENDING',controller:new AbortController(),reserve_called:false,reserve_reply:'UNOBSERVED'};
    this.#records.set(claim,record);this.#issued.push(record);
    const finish=(state)=>{if(record.state!=='PENDING')return;clearTimeout(record.timer);record.state=state;
      if(state!=='READY')record.controller.abort();if(!this.#closed)this.#refresh();};
    record.timer=setTimeout(()=>finish('TIMED_OUT'),this.#timeout);
    // Re-entering release from reserve is safe: record exists before callback.
    const base={...plan,generation:record.generation,document_instance_id:this.#documentInstance,gate_id:this.#gateId};
    const hash=()=>this.#contextHash.then(async context_sha256=>{
      const plan_sha256=await localDigest({...base,context_sha256});
      record.identity=freezeCopy({gate_id:this.#gateId,plan_id:plan.plan_id,context_sha256,plan_sha256,
        operation_id:this.#context?.operation_id??null,generation:record.generation});
      return record.identity;
    });
    record.hashes=this.#lifetimeRecords?this.#lifetimeRecords.run('gate.plan_hash',hash,{local_plan_id:record.local_plan_id,plan_id:plan.plan_id}):hash();
    const dispatch=externalPlan=>{
      if(record.state!=='PENDING'||this.#closed)return;
      try{record.reserve_called=true;const invoke=()=>this.#reserve(externalPlan,{signal:record.controller.signal});Promise.resolve(this.#lifetimeRecords?this.#lifetimeRecords.run('gate.reserve',invoke,{local_plan_id:record.local_plan_id,plan_id:plan.plan_id}):invoke()).then(ack=>{
        record.reserve_reply=ack===plan.plan_id?'MATCHING_PLAN_ID':'OTHER_VALUE';
        finish(ack===plan.plan_id&&!this.#closed&&this.#validContext()&&this.#epoch()===record.generation&&this.#current(current)?'READY':'DENIED');
      },()=>{record.reserve_reply='REJECTED';finish('UNCONFIRMED');});}catch{record.reserve_reply='THREW';finish('UNCONFIRMED');}
    };
    record.hashes.catch(()=>finish('UNCONFIRMED'));
    if(this.#contextMode)record.hashes.then(identity=>{if(this.#validContext()&&this.#epoch()===record.generation&&this.#current(current))dispatch(freezeCopy({...base,reservation_identity:identity}));else finish('DENIED');},()=>finish('UNCONFIRMED'));
    else dispatch(Object.freeze(base));
    return null;
  }
  cancel(claim) {
    const r=this.#records.get(claim);if(!r)return;
    this.#cleanupRevision++;
    clearTimeout(r.timer);r.controller.abort();if(['PENDING','READY'].includes(r.state))r.state='CANCELLED';
    this.#records.delete(claim);
  }
  close(){this.#cleanupRevision++;this.#closed=true;for(const claim of this.#records.keys())this.cancel(claim);}
  claims(){return [...new Set(this.#issued.map(r=>r.plan.claim))];}
  #localRecords(){return this.#issued.map(r=>({
    local_plan_id:r.local_plan_id,plan_id:r.plan.plan_id,generation:r.generation,
    // This identity is Content-derived, not a durable Core reservation receipt.
    identity:r.identity?structuredClone(r.identity):null,state:r.state,
    reserve_called:r.reserve_called,reserve_reply:r.reserve_reply,reserve_reply_pending:r.reserve_called&&r.reserve_reply==='UNOBSERVED',durable_commit_status:'UNCONFIRMED',
    completed:r.completed===true,obligation_pending:r.completed!==true
  }));}
  #localTracking(){const s=this.#originalContextScope;return {local_only:true,native_verified:false,gate_id:this.#gateId,
    gate_document_instance_id:this.#documentInstance,
    reserve_callbacks_unsettled:this.#issued.filter(r=>r.reserve_called&&r.reserve_reply==='UNOBSERVED').length,
    context_scope:s?structuredClone({owner_binding_id:s.owner_binding_id,binding_id:s.binding_id,
      generation:s.generation,document_instance_id:s.document_instance_id}):null};}
  async snapshot(){await this.#contextHash;await Promise.all(this.#issued.map(r=>r.hashes.catch(()=>null)));
    return structuredClone({gate_id:this.#gateId,context_bound:!!this.#context,closed:this.#closed,
      local_tracking:this.#localTracking(),local_records:this.#localRecords(),
      reservations:this.#issued.map(r=>({identity:r.identity??null,state:r.state,completed:r.completed===true,completion_pending:(r.verifying??0)>0}))});}
  async completeReservation(identity,proof,locallyRestored){
    const reject=reason=>({local_only:true,accepted:false,reason});
    if(!this.#context||typeof this.#verifyCompletion!=='function')return reject('COMPLETION_VERIFIER_REQUIRED');
    const revision=this.#cleanupRevision;
    await Promise.all(this.#issued.map(r=>r.hashes.catch(()=>null)));
    let record;try{record=this.#issued.find(r=>r.identity&&canonical(r.identity)===canonical(identity));}catch{}
    if(!record)return reject('RESERVATION_IDENTITY_MISMATCH');
    if(!this.#closed||!this.#current(locallyRestored)||revision!==this.#cleanupRevision)return reject('LOCAL_CLEANUP_UNCONFIRMED');
    const expected=freezeCopy({identity:record.identity,context:this.#context});
    let verified=false;record.verifying=(record.verifying??0)+1;
    try{const invoke=()=>this.#verifyCompletion(proof,expected);verified=await(this.#lifetimeRecords?this.#lifetimeRecords.run('gate.verifyCompletion',invoke,{local_plan_id:record.local_plan_id,plan_id:record.plan.plan_id}):invoke())===true;}catch{}finally{record.verifying--;}
    if(!verified)return reject('DURABLE_COMPLETION_UNCONFIRMED');
    // Check after the synchronous callback as well: it may re-enter close().
    // No await between this last check and consuming the verified completion.
    if(!this.#closed||!this.#current(locallyRestored)||revision!==this.#cleanupRevision)return reject('LOCAL_CLEANUP_UNCONFIRMED');
    const duplicate=record.completed===true;record.completed=true;
    return {local_only:true,accepted:true,duplicate};
  }
  inspect(){return {pending_reservations:this.#issued.filter(r=>r.state==='PENDING').length,
    local_tracking:this.#localTracking(),local_records:this.#localRecords(),
    // Once handed out, even an aborted/timed-out request may have committed in
    // the external store. Only the future verified Core completion can clear it.
    reservation_obligations:this.#issued.filter(r=>!r.completed).map(r=>({plan_id:r.plan.plan_id,claim:r.plan.claim,state:r.state,generation:r.generation}))};}
}
