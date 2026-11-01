// Internal opt-in scheduling seam only. A callback ACK is NOT a Core capability,
// CleanupGrant, ContentResult or Server receipt. No runtime listener/storage.
import {canonical,freezeCopy,localDigest,boundContext} from './local-evidence.mjs';
export class HideReservationGate {
  #ledger;#reserve;#generation;#refresh;#timeout;#closed=false;
  #records=new Map();#issued=[];
  #boundGeneration;#documentInstance=crypto.randomUUID();
  #maxPlans;
  #context;#verifyContext;#verifyCompletion;#contextMode;#contextHash;#gateId=crypto.randomUUID();
  constructor(ledger,{reserve,getGeneration,timeoutMs=5000,maxPlans=256,context,verifyContext,verifyCompletion}={},refresh=()=>{},owner={}) {
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw Error('INVALID_RESERVATION_TIMEOUT');
    if(!Number.isSafeInteger(maxPlans)||maxPlans<1||maxPlans>4096)throw Error('INVALID_RESERVATION_CAPACITY');
    this.#ledger=ledger;this.#reserve=reserve;this.#generation=getGeneration;this.#refresh=refresh;this.#timeout=timeoutMs;
    this.#boundGeneration=this.#epoch();
    this.#maxPlans=maxPlans;
    this.#contextMode=context!==undefined;this.#verifyContext=verifyContext;this.#verifyCompletion=verifyCompletion;
    if(this.#contextMode){
      try{this.#context=boundContext(context,owner,this.#boundGeneration);}catch{this.#context=null;}
    }
    this.#contextHash=this.#context?localDigest(this.#context).catch(()=>{this.#context=null;return null;}):Promise.resolve(null);
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
    record={plan,generation:this.#epoch(),state:'PENDING',controller:new AbortController()};
    this.#records.set(claim,record);this.#issued.push(record);
    const finish=(state)=>{if(record.state!=='PENDING')return;clearTimeout(record.timer);record.state=state;
      if(state!=='READY')record.controller.abort();if(!this.#closed)this.#refresh();};
    record.timer=setTimeout(()=>finish('TIMED_OUT'),this.#timeout);
    // Re-entering release from reserve is safe: record exists before callback.
    const base={...plan,generation:record.generation,document_instance_id:this.#documentInstance,gate_id:this.#gateId};
    record.hashes=this.#contextHash.then(async context_sha256=>{
      const plan_sha256=await localDigest({...base,context_sha256});
      record.identity=freezeCopy({gate_id:this.#gateId,plan_id:plan.plan_id,context_sha256,plan_sha256,
        operation_id:this.#context?.operation_id??null,generation:record.generation});
      return record.identity;
    });
    const dispatch=externalPlan=>{
      if(record.state!=='PENDING'||this.#closed)return;
      try{Promise.resolve(this.#reserve(externalPlan,{signal:record.controller.signal})).then(ack=>{
        finish(ack===plan.plan_id&&!this.#closed&&this.#validContext()&&this.#epoch()===record.generation&&this.#current(current)?'READY':'DENIED');
      },()=>finish('UNCONFIRMED'));}catch{finish('UNCONFIRMED');}
    };
    record.hashes.catch(()=>finish('UNCONFIRMED'));
    if(this.#contextMode)record.hashes.then(identity=>{if(this.#validContext()&&this.#epoch()===record.generation&&this.#current(current))dispatch(freezeCopy({...base,reservation_identity:identity}));else finish('DENIED');},()=>finish('UNCONFIRMED'));
    else dispatch(Object.freeze(base));
    return null;
  }
  cancel(claim) {
    const r=this.#records.get(claim);if(!r)return;
    clearTimeout(r.timer);r.controller.abort();if(['PENDING','READY'].includes(r.state))r.state='CANCELLED';
    this.#records.delete(claim);
  }
  close(){this.#closed=true;for(const claim of this.#records.keys())this.cancel(claim);}
  claims(){return [...new Set(this.#issued.map(r=>r.plan.claim))];}
  async snapshot(){await Promise.all(this.#issued.map(r=>r.hashes.catch(()=>null)));
    return structuredClone({gate_id:this.#gateId,context_bound:!!this.#context,closed:this.#closed,
      reservations:this.#issued.map(r=>({identity:r.identity??null,state:r.state,completed:r.completed===true,completion_pending:(r.verifying??0)>0}))});}
  async completeReservation(identity,proof,locallyRestored){
    const reject=reason=>({local_only:true,accepted:false,reason});
    if(!this.#context||typeof this.#verifyCompletion!=='function')return reject('COMPLETION_VERIFIER_REQUIRED');
    await Promise.all(this.#issued.map(r=>r.hashes.catch(()=>null)));
    let record;try{record=this.#issued.find(r=>r.identity&&canonical(r.identity)===canonical(identity));}catch{}
    if(!record)return reject('RESERVATION_IDENTITY_MISMATCH');
    if(!this.#closed||!this.#current(locallyRestored))return reject('LOCAL_CLEANUP_UNCONFIRMED');
    const expected=freezeCopy({identity:record.identity,context:this.#context});
    let verified=false;record.verifying=(record.verifying??0)+1;
    try{verified=await this.#verifyCompletion(proof,expected)===true;}catch{}finally{record.verifying--;}
    if(!verified)return reject('DURABLE_COMPLETION_UNCONFIRMED');
    if(!this.#closed||!this.#current(locallyRestored))return reject('LOCAL_CLEANUP_UNCONFIRMED');
    const duplicate=record.completed===true;record.completed=true;
    return {local_only:true,accepted:true,duplicate};
  }
  inspect(){return {pending_reservations:this.#issued.filter(r=>r.state==='PENDING').length,
    // Once handed out, even an aborted/timed-out request may have committed in
    // the external store. Only the future verified Core completion can clear it.
    reservation_obligations:this.#issued.filter(r=>!r.completed).map(r=>({plan_id:r.plan.plan_id,claim:r.plan.claim,state:r.state,generation:r.generation}))};}
}
