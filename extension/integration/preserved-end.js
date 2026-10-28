/* Existing Core offlineEnd + Server reconcile only. No refresh, START, SYNC or HOLD transition. */
(()=>{
 'use strict';
 const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s);
 const fail=c=>{throw Error(c);},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const keys=['contract','installation_id','extension_id','profile_instance','operation_id','executor_id','owner_user_id','session_id','policy_snapshot_id','base_revision','origin','callback','not_before','not_after'];
 function validate(g,{extensionId,origin,profileInstance},now=Date.now()){
  if(!g||!same(Object.keys(g).sort(),[...keys].sort())||g.contract!=='FOCURVE_PRESERVED_END_SCOPE_1'||!/^https:\/\/localhost:[0-9]{1,5}$/.test(g.origin??'')||g.extension_id!==extensionId||g.origin!==origin||g.profile_instance!==profileInstance||!['installation_id','profile_instance','operation_id'].every(k=>/^[a-f0-9]{32}$/.test(g[k]??''))||!['executor_id','session_id','policy_snapshot_id'].every(k=>uuid(g[k]))||!/^[1-9][0-9]{0,17}$/.test(g.owner_user_id??'')||!Number.isSafeInteger(g.base_revision)||g.base_revision<1||g.callback!=='chrome-extension://'+extensionId+'/popup/popup.html')fail('PRESERVED_END_SCOPE_INVALID');
  const begin=Date.parse(g.not_before),end=Date.parse(g.not_after);
  if(!Number.isFinite(begin)||!Number.isFinite(end)||begin>now||now>=end||end<=begin||end-begin>1200000)fail('PRESERVED_END_SCOPE_EXPIRED');
  return g;
 }
 class PreservedEnd {
  constructor({readGrant,getAdapter,getRawAuth,getInstallation,identity,fetch=globalThis.fetch.bind(globalThis),now=Date.now}){Object.assign(this,{readGrant,getAdapter,getRawAuth,getInstallation,identity,fetch,now});this.active=false;}
  async context(){
   const g=validate(await this.readGrant(),this.identity(),this.now()),a=this.getAdapter(),raw=await this.getRawAuth();
   if(!a||!raw||!['LINKED','AUTH_RECOVERY_REQUIRED'].includes(raw.phase)||raw.recovery_pending===true||String(raw.owner_user_id)!==g.owner_user_id||raw.executor_id!==g.executor_id||raw.server_url!==g.origin+'/api/v1'||raw.web_origin!==g.origin||typeof raw.installation_proof!=='string'||!raw.installation_proof)fail('PRESERVED_END_OWNER_MISMATCH');
   if((await this.getInstallation()).installation_id!==g.executor_id)fail('PRESERVED_END_OWNER_MISMATCH');
   const b=await a.core.bundle(),claim=await a.authority.current();
   if(!b||b.a.session_id!==g.session_id||b.a.owner_context!=='MEMBER:'+g.owner_user_id||b.a.executor_id!==g.executor_id||b.a.snapshot_ref.policy_snapshot_id!==g.policy_snapshot_id||b.state.session.member_admission?.authority!==g.origin+'/api/v1'||b.state.session.member_admission?.server_revision!==g.base_revision||!claim||claim.session_id!==g.session_id||claim.owner_key!==b.a.owner_context||claim.executor_id!==g.executor_id||claim.authority!==g.origin+'/api/v1'||!['ACTIVE','RELEASED'].includes(claim.phase))fail('PRESERVED_END_OWNER_MISMATCH');
   if(!['UNKNOWN','ENDING','ENDED'].includes(b.a.session_status))fail('PRESERVED_END_STATE_NOT_ALLOWED');
   // This adapter instance cannot resume ordinary work, even after local END.
   a.preservedEndScope=g;return {g,a,b};
  }
  async send(g,path,body){
   const c=await this.context();if(!same(c.g,g))fail('PRESERVED_END_SCOPE_CHANGED');
   const allowed=body===undefined?path==='/install/preserved-end'||path==='/sessions/'+g.session_id:path==='/executors/'+g.executor_id+'/reconcile'||path==='/executors/'+g.executor_id+'/reports';
   if(!allowed)fail('PRESERVED_END_ROUTE_DENIED');
   const raw=await this.getRawAuth(),abort=new AbortController(),timer=setTimeout(()=>abort.abort(),Math.min(10000,Date.parse(g.not_after)-this.now()));
   try{
    const response=await this.fetch(g.origin+'/api/v1'+path,{method:body===undefined?'GET':'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:abort.signal,headers:{'Content-Type':'application/json','X-Installation-Id':g.executor_id,'X-Installation-Proof':raw.installation_proof},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const value=await response.json();if(!response.ok)throw Error('PRESERVED_END_HTTP_'+response.status);
    if(!same((await this.context()).g,g))fail('PRESERVED_END_SCOPE_CHANGED');return value;
   }finally{clearTimeout(timer);}
  }
  async inspect(){const {g,a,b}=await this.context(),ready=await this.send(g,'/install/preserved-end');if(ready.operation_id!==g.operation_id||ready.session_id!==g.session_id||ready.owner_user_id!==g.owner_user_id||ready.executor_id!==g.executor_id||ready.focus_allowed!==false)fail('PRESERVED_END_SERVER_SCOPE_MISMATCH');const attempt=await a.read('member:preserved-end:'+g.operation_id),receipt=await a.read('member:local-end:'+g.session_id);const released=receipt?.confirmed===true&&b.a.session_status==='ENDED';if(released)await a.verifyRelease();return {available:true,local_status:b.a.session_status,can_end_local:b.a.session_status==='UNKNOWN'&&!attempt&&!receipt,operation_phase:attempt?.phase??'NOT_ATTEMPTED',local_release_confirmed:released,server_ended:ready.server_ended,focus_allowed:false,not_after:g.not_after};}
  async run(action){
   if(this.active)fail('PRESERVED_END_OPERATION_ACTIVE');this.active=true;
   try{
    const {g,a}=await this.context(),key='member:preserved-end:'+g.operation_id;
    if(action==='END_LOCAL'){
     await this.inspect();
     const b=await a.core.bundle();if(b.a.session_status!=='UNKNOWN')fail('PRESERVED_END_STATE_NOT_ALLOWED');
     // Durable one-attempt admission survives UI/Worker response loss. A second
     // call cannot re-execute END or invent a restoration receipt.
     await a.db.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').add({key,session_id:g.session_id,owner_key:'MEMBER:'+g.owner_user_id,executor_id:g.executor_id,phase:'END_ATTEMPTED',atUTC:new Date(this.now()).toISOString()});done(null);});
     try{
      await this.context();const r=await a.offlineEnd();await this.context();if(r.local_release_confirmed!==true)fail('RELEASE_UNCONFIRMED');
      await a.verifyRelease();await a.put(key,{session_id:g.session_id,owner_key:'MEMBER:'+g.owner_user_id,executor_id:g.executor_id,phase:'LOCAL_RELEASED_PENDING_SERVER'});
      return {local_release_confirmed:true,server_ended_confirmed:false,focus_allowed:false,hold_preserved:true};
     }catch(e){const attempt=await a.read(key);await a.put(key,{...attempt,phase:'FAILED_PRESERVED',failure_code:/^[A-Z][A-Z0-9_]{0,79}$/.test(e.message??'')?e.message:'END_RESULT_UNCONFIRMED'});throw e;}
    }
    if(action==='RECONCILE'){
     let attempt=await a.read(key);
     if(attempt?.phase!=='LOCAL_RELEASED_PENDING_SERVER'){
      // A fresh explicit grant may resume an existing immutable END receipt.
      // It cannot perform END again or replace the original action/report IDs.
      const receipt=await a.read('member:local-end:'+g.session_id);
      if(receipt?.confirmed!==true)fail('PRESERVED_END_LOCAL_RELEASE_REQUIRED');
      await a.verifyRelease();attempt={...attempt,session_id:g.session_id,owner_key:'MEMBER:'+g.owner_user_id,executor_id:g.executor_id,phase:'LOCAL_RELEASED_PENDING_SERVER',resumed_action_id:receipt.action_id,previous_phase:attempt?.phase??null};await a.put(key,attempt);
     }
     const r=await a.reconcilePreservedEnd(g,(path,body)=>this.send(g,path,body));
     await a.put(key,{...attempt,phase:'RECONCILED'});return r;
    }
    fail('PRESERVED_END_OPERATION_DENIED');
   }finally{this.active=false;}
  }
 }
 globalThis.FocurvePreservedEnd=Object.freeze({validate,PreservedEnd});
})();
