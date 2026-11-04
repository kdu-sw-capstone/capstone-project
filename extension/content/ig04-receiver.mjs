import {ContentSessionAdapter} from './session-adapter.mjs';
import {boundContext,canonical,freezeCopy} from './local-evidence.mjs';
import {LocalLifetime} from './local-lifetime.mjs';

// Trusted-call receiver seam. No Chrome listener, sender/authority issuer,
// ACK/proof Wire schema, storage implementation or ContentResult conversion.
export class IG04ContentReceiver {
  #document;#options;#worker;#url;#navigation;#id=crypto.randomUUID();#adapter;
  #input;#candidate;#key;#opening=false;#closed=false;#retired=false;#revision=0;#released=false;
  #workerLost=false;
  #lifetimeRecords;#listeners=[];#detaching=false;
  #localStartup={adapter_start_called:false,pagehide_listener:'NOT_ATTEMPTED',navigation_listener:'NOT_ATTEMPTED'};
  constructor(document,options={}){
    this.#document=document;this.#options={...options};this.#worker=this.#readWorker();this.#url=document.location.href;
    this.#lifetimeRecords=new LocalLifetime(this.#transport());
    this.pagehide=()=>this.#lifetimeRecords.run('receiver.pagehide',()=>this.invalidate('PAGEHIDE'));
    // URL round trips must retire this receiver before a pending ACK can win.
    this.route=()=>this.#lifetimeRecords.run('receiver.navigation',()=>this.#lifetime());
    this.#navigation=document.defaultView?.navigation;
  }
  #installListeners(context,revision){
    for(const [target,type,callback,key]of [[this.#document.defaultView,'pagehide',this.pagehide,'pagehide_listener'],
      [this.#navigation,'currententrychange',this.route,'navigation_listener']]){
      if(!target)continue;
      if(revision!==this.#revision||!this.#current(context))throw Error('REVALIDATION_REQUIRED');
      const resource=this.#lifetimeRecords.resource('receiver.'+type),entry={target,type,callback,key,resource,removed:false};this.#listeners.push(entry);
      this.#localStartup[key]='UNCONFIRMED';
      try{target.addEventListener(type,callback);}catch(error){entry.removed=false;resource.unknown();this.#localStartup[key]='UNCONFIRMED';throw error;}
      entry.removed=false;resource.attached();this.#localStartup[key]='ATTACHED';
      if(revision!==this.#revision||!this.#current(context))throw Error('REVALIDATION_REQUIRED');
    }
  }
  #detachListeners(){
    if(this.#detaching)return;this.#detaching=true;
    try{for(const entry of this.#listeners)if(!entry.removed){entry.resource.unknown();this.#localStartup[entry.key]='UNCONFIRMED';
      try{entry.target.removeEventListener(entry.type,entry.callback);entry.removed=true;entry.resource.removed();this.#localStartup[entry.key]='REMOVED';}catch{}
    }}finally{this.#detaching=false;}
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
  #startup(){return {...this.#localStartup,adapter_created:!!this.#adapter,
    receiver_resources_may_remain:['ATTACHED','UNCONFIRMED'].includes(this.#localStartup.pagehide_listener)||['ATTACHED','UNCONFIRMED'].includes(this.#localStartup.navigation_listener)};}
  #deny(reason){const local_lifetime=this.#lifetimeRecords.snapshot();return {local_only:true,native_verified:false,accepted:false,reason,cleanup_pending:(this.#adapter?.inspect().cleanup_pending??false)||!local_lifetime.drained,revalidation_required:this.#retired,local_startup:this.#startup(),local_lifetime};}
  invalidate(reason='AUTHORITY_REVOKED'){
    this.#closed=true;this.#retired=true;this.#revision++;this.#adapter?.invalidate(reason);
    this.#detachListeners();
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
      if(!this.#adapter){
        // Preparation protects this original instance's resources; it is not
        // APPLY admission. Install before awaiting input verification so a
        // pagehide during that wait is observed without starting an Adapter.
        if(typeof this.#options.prepareResources!=='function')return this.#deny('RESOURCE_PREPARATION_REQUIRED');
        this.#input=frozen;this.#key=key;this.#lifetimeRecords.bindContext(context);
        const preparation=this.#lifetimeRecords.resource('receiver.preparation_obligation');
        let prepared=false,unobservedWait=false;
        try{
          const result=this.#lifetimeRecords.run('receiver.prepareResources',()=>this.#options.prepareResources(authorization,freezeCopy({...frozen,transport:this.#transport()})));
          if(result&&typeof result.then==='function'){
            // No protected listener existed during this wait. Same document,
            // Worker and generation cannot prove that pagehide/BFCache did not
            // occur. Observe settlement, but never consume this ACK to install.
            unobservedWait=true;await result;
          }else prepared=result===true;
        }catch{}
        if(unobservedWait){this.#closed=true;return this.#deny('RESOURCE_LIFETIME_REVALIDATION_REQUIRED');}
        if(revision!==this.#revision||!this.#current(context)||!prepared){this.#closed=true;return this.#deny('RESOURCE_PREPARATION_UNCONFIRMED');}
        preparation.inactive();
        this.#installListeners(context,revision);
      }
      let verified=false;try{verified=await this.#lifetimeRecords.run('receiver.verifyInput',()=>this.#options.verifyInput(authorization,freezeCopy({...frozen,transport:this.#transport()})))===true;}catch{}
      if(!this.#lifetime()||this.#closed||revision!==this.#revision)return this.#deny('REVALIDATION_REQUIRED');
      if(!verified||!this.#current(context)){
        if(!this.#adapter){this.#closed=true;this.#detachListeners();}
        return this.#deny('INPUT_AUTHORITY_UNCONFIRMED');
      }
      if(this.#adapter)return await this.#appliedQuery(context,revision,true);
      const lifetime=this.#transport();
      this.#adapter=new ContentSessionAdapter(this.#document,{
        owner_binding_id:context.scope.owner_binding_id,binding_id:context.scope.binding_id,features:frozen.features,ledger:this.#options.ledger,
        isCurrent:()=>this.#current(context),authorizeNavigation:()=>false,localLifetime:this.#lifetimeRecords,
        ig04Reservation:{context,localLifetime:this.#lifetimeRecords,getGeneration:()=>this.#generation(),verifyContext:c=>this.#current(c),
          reserve:async(plan,{signal})=>{if(signal.aborted||!this.#current(context))throw Error('REVALIDATION_REQUIRED');
            const ack=await this.#lifetimeRecords.run('receiver.reserve',()=>this.#options.reserve(plan,{signal,transport:lifetime}));return this.#current(context)?ack:undefined;},
          verifyCompletion:async(proof,expected)=>{if(!this.#cleanupLifetime())return false;
            const ok=await this.#lifetimeRecords.run('receiver.verifyCompletion',()=>this.#options.verifyCompletion(proof,freezeCopy({...expected,transport:lifetime})));return this.#cleanupLifetime()&&ok===true;},
          timeoutMs:this.#options.timeoutMs??5000,maxPlans:this.#options.maxPlans??256}
      });
      this.#localStartup.adapter_start_called=true;
      const result=this.#adapter.start();
      if(result.startup_error){this.#closed=true;return this.#deny('CONTENT_START_FAILED');}
      return await this.#appliedQuery(context,revision,false);
    }catch{this.#closed=true;this.#adapter?.invalidate('CONTENT_START_FAILED');this.#detachListeners();return this.#deny('CONTENT_START_FAILED');}
    finally{this.#opening=false;if(!this.#input)this.#candidate=null;}
  }
  async #appliedQuery(context,revision,duplicate){
    const result=await this.query();
    // Query itself waits; dispatch acceptance must not survive a release/retirement.
    if(revision!==this.#revision||!this.#current(context))return this.#deny('REVALIDATION_REQUIRED');
    return {accepted:true,duplicate,...result};
  }
  async query(){
    this.#lifetime();if(!this.#closed&&this.#input)this.#current(this.#input.context);
    const revision=this.#revision,adapter=this.#adapter;
    let snapshot=null;try{if(adapter)snapshot=await adapter.evidenceSnapshot('IG-04');}catch{}
    // A local snapshot is not a current authority proof. Preserve old-scope
    // cleanup reads, but never combine a pre-transition snapshot with new state.
    this.#lifetime();if(!this.#closed&&this.#input)this.#current(this.#input.context);
    if(revision!==this.#revision||adapter!==this.#adapter)snapshot=null;
    return {local_only:true,native_verified:false,...this.#transport(),revalidation_required:this.#retired,
      local_startup:this.#startup(),local_lifetime:this.#lifetimeRecords.snapshot(),
      phase:this.#retired?'REVALIDATION_REQUIRED':this.#closed?'CLOSED_LOCAL':this.#adapter?'BOUND_LOCAL':'UNBOUND',
      state:this.#adapter?.inspect()??null,snapshot};
  }
  async quiescenceSnapshot(){
    // Internal local producer only: no watch_ref, cutoff, Grant or terminal.
    // Stop future effects before yielding, without granting scoped RELEASE.
    this.#closed=true;this.#retired=true;this.#revision++;
    this.#detachListeners();
    const revision=this.#revision,adapter=this.#adapter;
    let result=null;try{if(adapter)result=await adapter.quiescenceSnapshot();}catch{}
    // Pending verifyInput cannot start an adapter after retirement. Report it
    // until the actual continuation finishes rather than inventing a drain.
    const lifetime_current=this.#cleanupLifetime();
    const current=revision===this.#revision&&adapter===this.#adapter&&lifetime_current;
    const detached=!this.#startup().receiver_resources_may_remain;
    const local_lifetime=this.#lifetimeRecords.snapshot();
    return {local_only:true,native_verified:false,...this.#transport(),context:freezeCopy((this.#input??this.#candidate)?.context??null),
      local_startup:this.#startup(),local_lifetime,state:this.#adapter?.inspect()??null,snapshot:current?result?.snapshot??null:null,
      local_quiescence:{future_effects_closed:this.#closed,receiver_listeners_detached:detached,input_verification_pending:this.#opening,
        lifetime_current,locally_quiescent:current&&detached&&!this.#opening&&local_lifetime.drained&&(adapter?result?.local_quiescence.locally_quiescent===true:true)}};
  }
  async release(bindingContext,authorization){
    if(!this.#ready()||!this.#cleanupLifetime())return this.#deny('REVALIDATION_REQUIRED');
    const bound=this.#input??this.#candidate;if(!bound)return this.#deny('RECEIVER_NOT_BOUND');
    try{if(canonical(bindingContext)!==canonical(bound.context))return this.#deny('RELEASE_SCOPE_MISMATCH');}catch{return this.#deny('RELEASE_SCOPE_MISMATCH');}
    let ok=false;try{ok=await this.#lifetimeRecords.run('receiver.verifyRelease',()=>this.#options.verifyRelease(authorization,freezeCopy({context:bound.context,transport:this.#transport()})))===true;}catch{}
    if(!this.#cleanupLifetime()||!ok)return this.#deny('RELEASE_AUTHORITY_UNCONFIRMED');
    const current=this.#input??this.#candidate;
    if(!current||canonical(current.context)!==canonical(bound.context))return this.#deny('RELEASE_SCOPE_MISMATCH');
    // Cleanup authority is independent of current APPLY permission/generation.
    this.#closed=true;this.#revision++;this.#released=true;this.#detachListeners();this.#adapter?.release();
    return {accepted:true,...await this.query()};
  }
  async completeReservation(bindingContext,identity,proof){
    if(!this.#cleanupLifetime()||!this.#adapter||!this.#released)return this.#deny('SCOPED_RELEASE_REQUIRED');
    try{if(canonical(bindingContext)!==canonical(this.#input.context))return this.#deny('COMPLETION_SCOPE_MISMATCH');}catch{return this.#deny('COMPLETION_SCOPE_MISMATCH');}
    const result=await this.#adapter.completeReservation(identity,proof);
    return {...result,...await this.query()};
  }
}
