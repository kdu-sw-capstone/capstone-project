import { VERSION, UUID, validateA0, canonical, fingerprint, freeze, workerSender, error, ok, confirmedEffect, confirmedRelease } from './contract.mjs';
// One independently injected authority, one Content instance, one frozen policy.
export class A0Receiver {
 constructor({authority,instance,runtime,store,effect,queueLimit=32}){
  this.authority=freeze(structuredClone(authority));this.instance=instance;this.runtime=runtime;this.store=store;this.effect=effect;this.queueLimit=queueLimit;
  this.row={instance,authority:this.authority,lifecycle:'ACTIVE',seq:0,operations:{},fifo:[],cleanup:[],ledger:[],cleanup_pending:false,registered:false,applyClosed:false,current:null,blocked:false};
  this.tail=Promise.resolve();this.inflight=new Map();this.pending=0;this.ready=this.store.load().then(old=>{if(old)throw new Error('INSTANCE_ALREADY_REGISTERED');return this.save();});
 }
 save(change=null){return this.store.save(this.row,change);}
 scope(message){
  const q=message.payload,a=this.authority;
  if(q.target_document_id!==a.context.document_id)return 'SCOPE_MISMATCH';
  if(q.context===null)return this.row.lifecycle==='ACTIVE'?null:'INACTIVE_DOCUMENT';
  if(message.owner_context!==a.owner_context||canonical(q.context)!==canonical(a.context))return 'SCOPE_MISMATCH';
  if(q.content_instance_id!==this.instance)return 'INSTANCE_MISMATCH';
  if(q.operation==='APPLY'&&(canonical(q.policy)!==canonical(a.policy)||q.rule_id!==a.rule_id||q.cleanup_authorization_id!==a.cleanup_authorization_id))return 'SCOPE_MISMATCH';
  if(q.operation==='RELEASE'&&(!this.row.registered||q.applied_binding_id!==a.context.binding_id||q.cleanup_authorization_id!==a.cleanup_authorization_id))return 'UNKNOWN_CLEANUP_BINDING';
  if(this.row.lifecycle!=='ACTIVE'&&!(q.operation==='RELEASE'&&q.release_mode==='CLEANUP_ONLY'))return 'INACTIVE_DOCUMENT';
  return null;
 }
 handle(message,sender){
  if(!UUID.test(message?.request_id??''))return Promise.resolve(null); // uncorrelatable transport rejection
  if(!workerSender(sender,this.runtime))return Promise.resolve(error(message.request_id,'UNAUTHORIZED_SENDER'));
  if(!validateA0(message)||message.type!=='D06_CONTENT_CONTROL')return Promise.resolve(error(message.request_id,'INVALID_SCHEMA'));
  const fail=this.scope(message);if(fail)return Promise.resolve(error(message.request_id,fail));
  const q=message.payload,fp=fingerprint(message),id=q.operation_id;
  const ongoing=this.inflight.get(id);if(ongoing)return ongoing.fp===fp?ongoing.promise.then(r=>({...r,request_id:message.request_id})):Promise.resolve(error(message.request_id,'OPERATION_CONFLICT'));
  if(this.pending>=this.queueLimit&&q.operation!=='RELEASE')return Promise.resolve(error(message.request_id,'QUEUE_FULL',true));
  // Authenticated NEW release preempts observation/async scans, never duplicate replay.
  if(q.operation==='RELEASE'&&!this.row.operations[id]&&this.row.cleanup.length<32&&(q.release_mode==='CLEANUP_ONLY'?(this.row.cleanup_pending||this.row.blocked||this.row.seq===Number.MAX_SAFE_INTEGER):q.control_seq>this.row.seq))this.effect.stopEpoch();
  this.pending++;
  const promise=this.tail.then(()=>this.process(message,fp)).catch(()=>{this.row.blocked=true;this.row.cleanup_pending=this.row.registered;return error(message.request_id,'STORAGE_FAILED',true);}).finally(()=>{this.pending--;this.inflight.delete(id);});
  this.tail=promise.then(()=>undefined);this.inflight.set(id,{fp,promise});return promise;
 }
 async process(m,fp){
  try{await this.ready;}catch{return error(m.request_id,'STORAGE_FAILED',true);}
  const q=m.payload,id=q.operation_id;const fail=this.scope(m);if(fail)return error(m.request_id,fail);
  const prior=this.row.operations[id];
  if(prior){if(prior.fp!==fp)return error(m.request_id,'OPERATION_CONFLICT');if(prior.storageFailed)return error(m.request_id,'STORAGE_FAILED',true);return prior.response?{...structuredClone(prior.response),request_id:m.request_id}:error(m.request_id,'OPERATION_RESULT_EVICTED');}
  const cleanup=q.operation==='RELEASE';
  if(cleanup&&this.row.cleanup.length>=32){this.row.blocked=true;this.row.cleanup_pending=true;try{await this.save();}catch{}return error(m.request_id,'REGISTRY_CAPACITY');}
  if(!cleanup&&Object.values(this.row.operations).filter(x=>!x.cleanup).length>=256)return error(m.request_id,'REGISTRY_CAPACITY');
  if(q.operation==='APPLY'&&(this.row.applyClosed||this.row.registered||this.row.blocked))return error(m.request_id,'CLEANUP_REQUIRED');
  if(q.operation!=='QUERY'){
   if(q.release_mode==='CLEANUP_ONLY'){
    if(!(this.row.seq===Number.MAX_SAFE_INTEGER||this.row.cleanup_pending||this.pending>=this.queueLimit||this.row.blocked))return error(m.request_id,'CLEANUP_REQUIRED');
    this.row.applyClosed=true;
   }else if(q.control_seq<=this.row.seq)return error(m.request_id,'STALE_CONTROL');
  }
  this.row.operations[id]={fp,cleanup,response:null};if(cleanup)this.row.cleanup.push(id);
  if(q.operation!=='QUERY'&&q.release_mode!=='CLEANUP_ONLY')this.row.seq=q.control_seq;
  if(q.operation==='APPLY'){this.row.registered=true;this.row.cleanup_pending=true;this.row.reserved_cleanup_slots=32;}
  try{await this.save({kind:'BEGIN_OPERATION',operation_id:id});}catch{this.row.operations[id].storageFailed=true;this.row.blocked=true;if(cleanup){this.effect.stopEpoch();try{await this.effect.release();}catch{}}return error(m.request_id,'STORAGE_FAILED',true);}
  const data={contract_version:VERSION,operation_id:id,operation:q.operation,target_document_id:q.target_document_id,content_instance_id:this.instance};
  let response;
  if(q.operation==='QUERY'){
   if(q.context===null)response=ok(m.request_id,{...data,adapter_ready:!this.row.blocked});
   else{
    if(this.row.current?.result_state==='APPLIED'&&this.row.lifecycle==='ACTIVE'){
     const e=this.effect.evidence();this.row.current.evidence=e;if(!confirmedEffect(e)){this.row.current.result_state='APPLY_FAILED';this.row.current.effect='UNCONFIRMED';this.row.current.binding_state='CLEANUP_PENDING';}
    }
    response=ok(m.request_id,{...data,adapter_ready:!this.row.blocked,current:this.row.current});
   }
  }else if(q.operation==='APPLY'){
   this.row.current={binding_state:'ACTIVE',lifecycle:this.row.lifecycle,control_seq:this.row.seq,result_state:'OBSERVING',effect:'UNCONFIRMED',round_id:q.observation.round_id,evidence:null,release_evidence:null};
   const result=await this.effect.start(async ledger=>{this.row.ledger=ledger;await this.save({kind:'LEDGER_PLAN',operation_id:id,entries:ledger});});
   const success=result.result_state==='APPLIED'&&this.row.lifecycle==='ACTIVE'&&confirmedEffect(result.evidence);
   if(result.result_state==='APPLIED'&&!success)result.result_state='APPLY_FAILED';
   this.row.current={...this.row.current,binding_state:success?'ACTIVE':'CLEANUP_PENDING',lifecycle:this.row.lifecycle,result_state:result.result_state,effect:success?'CONFIRMED':'UNCONFIRMED',evidence:result.evidence};
   response=ok(m.request_id,{...data,result_state:result.result_state,effect:success?'CONFIRMED':'UNCONFIRMED',round_id:q.observation.round_id,evidence:result.evidence});
  }else{
   this.row.applyClosed=true;const evidence=await this.effect.release();const success=confirmedRelease(evidence);
   if(success){this.row.cleanup_pending=false;this.row.ledger=[];}else this.row.cleanup_pending=true;
   this.row.current={binding_state:success?'RESTORED':'CLEANUP_PENDING',lifecycle:this.row.lifecycle,control_seq:this.row.seq,result_state:success?'RELEASED':'RELEASE_FAILED',effect:success?'CONFIRMED':'UNCONFIRMED',round_id:null,evidence:null,release_evidence:evidence};
   response=ok(m.request_id,{...data,result_state:success?'RELEASED':'RELEASE_FAILED',effect:success?'CONFIRMED':'UNCONFIRMED',applied_binding_id:q.applied_binding_id,release_evidence:evidence});
  }
  if(!validateA0(response))throw new Error('INVALID_INTERNAL_RESPONSE');
  this.row.operations[id].response=structuredClone(response);
  if(!cleanup){this.row.fifo.push(id);while(this.row.fifo.length>64){const evicted=this.row.fifo.shift();this.row.operations[evicted].response=null;}}
  try{await this.save({kind:'COMPLETE_OPERATION',operation_id:id,response});}catch{this.row.operations[id].response=null;this.row.operations[id].storageFailed=true;this.row.blocked=true;this.row.cleanup_pending=this.row.registered;this.effect.stopEpoch();await this.effect.release();return error(m.request_id,'STORAGE_FAILED',true);}
  return response;
 }
 invalidate(){
  this.row.lifecycle='INACTIVE';this.row.applyClosed=true;this.row.cleanup_pending=this.row.registered;
  this.effect.stopEpoch();if(this.row.current){this.row.current.lifecycle='INACTIVE';this.row.current.effect='UNCONFIRMED';this.row.current.binding_state='CLEANUP_PENDING';}
  // Preserve the original authorization, ledger and operation fingerprints.
  this.tail=this.tail.then(async()=>{await this.effect.release();await this.save({kind:'INVALIDATE',reason:'PAGEHIDE'});}).catch(()=>{this.row.blocked=true;});
  return this.tail;
 }
}
