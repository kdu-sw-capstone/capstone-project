import {ContentSessionAdapter} from './session-adapter.mjs';
import {boundContext,canonical,freezeCopy} from './local-evidence.mjs';

// Trusted-call receiver seam. No Chrome listener, sender/authority issuer,
// ACK/proof Wire schema, storage implementation or ContentResult conversion.
export class IG04ContentReceiver {
  #document;#options;#worker;#url;#id=crypto.randomUUID();#adapter;
  #input;#candidate;#key;#opening=false;#closed=false;#retired=false;#revision=0;#released=false;
  #workerLost=false;
  constructor(document,options={}){
    this.#document=document;this.#options={...options};this.#worker=this.#readWorker();this.#url=document.location.href;
    this.pagehide=()=>this.invalidate('PAGEHIDE');document.defaultView?.addEventListener('pagehide',this.pagehide);
  }
  #sync(fn){try{const v=fn();if(v&&typeof v.then==='function'){Promise.resolve(v).catch(()=>{});return undefined;}return v;}catch{return undefined;}}
  #readWorker(){const v=this.#sync(()=>this.#options.getWorkerInstance?.());return typeof v==='string'&&v.length>0&&v.length<=200?v:null;}
  #generation(){const v=this.#sync(()=>this.#options.getGeneration?.());return Number.isSafeInteger(v)&&v>0?v:null;}
  #cleanupLifetime(){
    if(this.#workerLost)return false;
    if(!this.#worker||this.#readWorker()!==this.#worker){this.#workerLost=true;this.invalidate('WORKER_REVALIDATION_REQUIRED');return false;}
    if(this.#document.defaultView?.document!==this.#document){this.invalidate('DOCUMENT_REVALIDATION_REQUIRED');return false;}
    return true;
  }
  #lifetime(){
    if(this.#retired)return false;
    if(!this.#cleanupLifetime())return false;
    if(this.#document.location.href!==this.#url){this.invalidate('DOCUMENT_REVALIDATION_REQUIRED');return false;}
    return true;
  }
  #current(context){
    if(this.#closed||!this.#lifetime())return false;
    if(this.#generation()!==context.scope.generation){this.invalidate('GENERATION_REVALIDATION_REQUIRED');return false;}
    if(this.#sync(()=>this.#options.isCurrent?.(context,this.#transport()))!==true){this.invalidate('AUTHORITY_REVOKED');return false;}
    return true;
  }
  #transport(){return freezeCopy({receiver_instance_id:this.#id,worker_instance_id:this.#worker});}
  #ready(){return ['verifyInput','isCurrent','reserve','getGeneration','getWorkerInstance','verifyRelease','verifyCompletion'].every(k=>typeof this.#options[k]==='function');}
  #deny(reason){return {local_only:true,native_verified:false,accepted:false,reason,cleanup_pending:this.#adapter?.inspect().cleanup_pending??false,revalidation_required:this.#retired};}
  invalidate(reason='AUTHORITY_REVOKED'){
    this.#closed=true;this.#retired=true;this.#revision++;this.#adapter?.invalidate(reason);
    return this.#deny(reason);
  }
  async apply(input,authorization){
    if(!this.#ready())return this.#deny('CORE_APIS_REQUIRED');
    if(!this.#lifetime()||this.#closed)return this.#deny('REVALIDATION_REQUIRED');
    if(this.#opening)return this.#deny('RECEIVER_BUSY');
    let frozen,context,key;
    try{
      frozen=freezeCopy(input);
      if(Object.keys(frozen).length!==2||!Object.hasOwn(frozen,'context')||!Object.hasOwn(frozen,'features'))throw Error();
      const features=frozen.features;
      if(!Array.isArray(features)||features.length!==1||canonical(features[0])!==canonical({feature_id:'IG-04',enabled:true,required:true}))throw Error();
      const s=frozen.context.scope;context=boundContext(frozen.context,{owner_binding_id:s.owner_binding_id,binding_id:s.binding_id},this.#generation());
      key=canonical(frozen);
    }catch{return this.#deny('INVALID_IG04_INPUT');}
    if(this.#input&&key!==this.#key)return this.#deny('RECEIVER_ALREADY_BOUND');
    this.#opening=true;this.#candidate=frozen;const revision=this.#revision;
    try{
      let verified=false;try{verified=await this.#options.verifyInput(authorization,freezeCopy({...frozen,transport:this.#transport()}))===true;}catch{}
      if(!this.#lifetime()||this.#closed||revision!==this.#revision)return this.#deny('REVALIDATION_REQUIRED');
      if(!verified||!this.#current(context))return this.#deny('INPUT_AUTHORITY_UNCONFIRMED');
      if(this.#adapter)return {accepted:true,duplicate:true,...await this.query()};
      this.#input=frozen;this.#key=key;
      const lifetime=this.#transport();
      this.#adapter=new ContentSessionAdapter(this.#document,{
        owner_binding_id:context.scope.owner_binding_id,binding_id:context.scope.binding_id,features:frozen.features,ledger:this.#options.ledger,
        isCurrent:()=>this.#current(context),authorizeNavigation:()=>false,
        ig04Reservation:{context,getGeneration:()=>this.#generation(),verifyContext:c=>this.#current(c),
          reserve:async(plan,{signal})=>{if(signal.aborted||!this.#current(context))throw Error('REVALIDATION_REQUIRED');
            const ack=await this.#options.reserve(plan,{signal,transport:lifetime});return this.#current(context)?ack:undefined;},
          verifyCompletion:async(proof,expected)=>{if(!this.#cleanupLifetime())return false;
            const ok=await this.#options.verifyCompletion(proof,freezeCopy({...expected,transport:lifetime}));return this.#cleanupLifetime()&&ok===true;},
          timeoutMs:this.#options.timeoutMs??5000,maxPlans:this.#options.maxPlans??256}
      });
      const result=this.#adapter.start();
      if(result.startup_error){this.#closed=true;return this.#deny('CONTENT_START_FAILED');}
      return {accepted:true,duplicate:false,...await this.query()};
    }catch{this.#closed=true;this.#adapter?.invalidate('CONTENT_START_FAILED');return this.#deny('CONTENT_START_FAILED');}
    finally{this.#opening=false;if(!this.#input)this.#candidate=null;}
  }
  async query(){
    this.#lifetime();let snapshot=null;try{if(this.#adapter)snapshot=await this.#adapter.evidenceSnapshot('IG-04');}catch{}
    // Recheck after the snapshot's asynchronous hashing wait.
    this.#lifetime();
    return {local_only:true,native_verified:false,...this.#transport(),revalidation_required:this.#retired,
      phase:this.#retired?'REVALIDATION_REQUIRED':this.#closed?'CLOSED_LOCAL':this.#adapter?'BOUND_LOCAL':'UNBOUND',
      state:this.#adapter?.inspect()??null,snapshot};
  }
  async release(bindingContext,authorization){
    if(!this.#ready()||!this.#cleanupLifetime())return this.#deny('REVALIDATION_REQUIRED');
    const bound=this.#input??this.#candidate;if(!bound)return this.#deny('RECEIVER_NOT_BOUND');
    try{if(canonical(bindingContext)!==canonical(bound.context))return this.#deny('RELEASE_SCOPE_MISMATCH');}catch{return this.#deny('RELEASE_SCOPE_MISMATCH');}
    let ok=false;try{ok=await this.#options.verifyRelease(authorization,freezeCopy({context:bound.context,transport:this.#transport()}))===true;}catch{}
    if(!this.#cleanupLifetime()||!ok)return this.#deny('RELEASE_AUTHORITY_UNCONFIRMED');
    const current=this.#input??this.#candidate;
    if(!current||canonical(current.context)!==canonical(bound.context))return this.#deny('RELEASE_SCOPE_MISMATCH');
    // Cleanup authority is independent of current APPLY permission/generation.
    this.#closed=true;this.#revision++;this.#released=true;this.#adapter?.release();
    return {accepted:true,...await this.query()};
  }
  async completeReservation(bindingContext,identity,proof){
    if(!this.#cleanupLifetime()||!this.#adapter||!this.#released)return this.#deny('SCOPED_RELEASE_REQUIRED');
    try{if(canonical(bindingContext)!==canonical(this.#input.context))return this.#deny('COMPLETION_SCOPE_MISMATCH');}catch{return this.#deny('COMPLETION_SCOPE_MISMATCH');}
    const result=await this.#adapter.completeReservation(identity,proof);
    return {...result,...await this.query()};
  }
}
