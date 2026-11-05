// Internal opt-in scheduling seam only. A callback ACK is NOT a Core capability,
// CleanupGrant, ContentResult or Server receipt. No runtime listener/storage.
export class HideReservationGate {
  #ledger;#reserve;#generation;#refresh;#timeout;#closed=false;
  #records=new Map();#issued=[];
  #boundGeneration;#documentInstance=crypto.randomUUID();
  #maxPlans;
  constructor(ledger,{reserve,getGeneration,timeoutMs=5000,maxPlans=256}={},refresh=()=>{}) {
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw Error('INVALID_RESERVATION_TIMEOUT');
    if(!Number.isSafeInteger(maxPlans)||maxPlans<1||maxPlans>4096)throw Error('INVALID_RESERVATION_CAPACITY');
    this.#ledger=ledger;this.#reserve=reserve;this.#generation=getGeneration;this.#refresh=refresh;this.#timeout=timeoutMs;
    this.#boundGeneration=this.#epoch();
    this.#maxPlans=maxPlans;
  }
  #epoch(){try{const v=this.#generation?.();if(v&&typeof v.then==='function')Promise.resolve(v).catch(()=>{});
    return Number.isSafeInteger(v)&&v>0?v:null;}catch{return null;}}
  #current(check){try{const v=check();if(v&&typeof v.then==='function')Promise.resolve(v).catch(()=>{});return v===true;}catch{return false;}}
  hide(claim,element,current) {
    if(this.#closed||!this.#current(current)||this.#boundGeneration===null)return false;
    if(this.#epoch()!==this.#boundGeneration){this.close();return false;}
    let record=this.#records.get(claim);
    if(record?.state==='APPLIED'&&this.#ledger.isHiddenBy(claim,element,record.plan))return true;
    if(record?.state==='READY'){
      if(this.#epoch()!==record.generation){record.state='STALE';return false;}
      const applied=this.#ledger.applyHidePlan(record.plan,element,()=>!this.#closed&&this.#epoch()===record.generation&&this.#current(current));
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
    const externalPlan=Object.freeze({...plan,generation:record.generation,document_instance_id:this.#documentInstance});
    try{Promise.resolve(this.#reserve(externalPlan,{signal:record.controller.signal})).then(ack=>{
      finish(ack===plan.plan_id&&!this.#closed&&this.#epoch()===record.generation&&this.#current(current)?'READY':'DENIED');
    },()=>finish('UNCONFIRMED'));}catch{finish('UNCONFIRMED');}
    return null;
  }
  cancel(claim) {
    const r=this.#records.get(claim);if(!r)return;
    clearTimeout(r.timer);r.controller.abort();if(['PENDING','READY'].includes(r.state))r.state='CANCELLED';
    this.#records.delete(claim);
  }
  close(){this.#closed=true;for(const claim of this.#records.keys())this.cancel(claim);}
  inspect(){return {pending_reservations:this.#issued.filter(r=>r.state==='PENDING').length,
    // Once handed out, even an aborted/timed-out request may have committed in
    // the external store. Only the future verified Core completion can clear it.
    reservation_obligations:this.#issued.map(r=>({plan_id:r.plan.plan_id,claim:r.plan.claim,state:r.state,generation:r.generation}))};}
}
