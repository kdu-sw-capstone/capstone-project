(()=>{
// Same-owner reauthentication actor. Product composition and Server both require
// a bounded recovery scope; this actor never retries an uncertain refresh token.
const version='SAME_OWNER_RECOVERY_1_CANDIDATE',uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const counts=['activeSessions','unknownAggregates','unresolvedBindings','cleanupPending','pendingLeases','inFlightOrInDoubt','unreleasedJournals','pendingOutbox','pendingImportLeases','pendingImportSettings','sessionRules','dynamicRules'];
class SameOwnerRecovery {
 constructor({auth,inspectObligations,isolated}){if(isolated!==true||!auth||typeof inspectObligations!=='function')throw Error('ISOLATED_RECOVERY_REQUIRED');Object.assign(this,{auth,inspectObligations});this.attempts=new Set();this.polls=new Set();}
 async safe(r){
  if(!uuid.test(r.executor_id??'')||!r.installation_proof||!/^[1-9][0-9]*$/.test(r.owner_user_id??''))throw Error('RECOVERY_IDENTITY_REQUIRED');
  const o=await this.inspectObligations();
  if(o?.owner!=='MEMBER:'+r.owner_user_id||o.executor!==r.executor_id||o.memberRootPhase!=='RELEASED'||counts.some(k=>!Number.isSafeInteger(o[k])||o[k]!==0))throw Error('RECOVERY_OBLIGATION_UNCONFIRMED');
 }
 failure(code){return /^[A-Z_0-9]{1,64}$/.test(code??'')?code:'RECOVERY_RESPONSE_UNCONFIRMED';}
 begin(config,approvalId){
  if(!uuid.test(approvalId??'')||this.attempts.has(approvalId))return Promise.reject(Error('RECOVERY_ATTEMPT_ALREADY_USED'));
  this.attempts.add(approvalId);
  return this.auth.serial(async()=>{
   const a=this.auth;let r=await a.load();
   if(r.phase!=='AUTH_RECOVERY_REQUIRED'||r.recovery_attempt_id===approvalId)throw Error('RECOVERY_NOT_ADMISSIBLE');
   await this.safe(r);if(config.server_url!==r.server_url||config.web_origin!==r.web_origin)throw Error('RECOVERY_AUTHORITY_CHANGED');
   const owner=r.owner_user_id,executor=r.executor_id,verifier=a.random(),state=a.random(),digest=new Uint8Array(await a.crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
   const challenge=btoa(String.fromCharCode(...digest)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
   r=await a.store.put({...r,phase:'REQUESTING',error:null,recovery_poll_attempted:false,recovery_mode:version,recovery_attempt_id:approvalId,recovery_first_error:r.recovery_first_error??r.error,verifier,state,expires_at:a.now()+300000});
   try{
    const x=await a.request(r,'/extension-link-requests',{executor_id:executor,recovery_owner_user_id:owner,code_challenge:challenge,state,callback_uri:a.callbackUri},{'X-Installation-Proof':r.installation_proof});
    const expires=Date.parse(x.expires_at);if(!uuid.test(x.link_request_id??'')||!Number.isFinite(expires)||expires<=a.now()||expires>a.now()+305000||x.verification_uri!==r.web_origin+'/#link?id='+x.link_request_id)throw Error('INVALID_AUTH_RESPONSE');
    r=await a.store.put({...r,phase:'LINK_PENDING',link_request_id:x.link_request_id,expires_at:expires});await this.safe(r);await a.evidence(r);await a.openApproval(x.verification_uri);return a.publicState(r);
   }catch(e){await a.store.put({...r,phase:'AUTH_RECOVERY_REQUIRED',error:this.failure(e.message)});throw e;}
  });
 }
 poll(){return this.auth.serial(async()=>{
  const a=this.auth;let r=await a.load();if(r.phase!=='LINK_PENDING'||r.recovery_mode!==version||this.polls.has(r.recovery_attempt_id)||r.recovery_poll_attempted)throw Error('RECOVERY_POLL_NOT_ADMISSIBLE');
  await this.safe(r);
  try{
   await a.evidence(r);const x=await a.request(r,'/extension-link-requests/'+r.link_request_id+'/claim',{state:r.state},{'X-Installation-Proof':r.installation_proof});
   if(x.status==='PENDING')return a.publicState(r);
   if(x.status!=='APPROVED'||x.state!==r.state||!/^[-_a-zA-Z0-9]{32,256}$/.test(x.code??''))throw Error('INVALID_AUTH_RESPONSE');
   this.polls.add(r.recovery_attempt_id);await this.safe(r);r=await a.store.put({...r,recovery_poll_attempted:true,phase:'EXCHANGING',error:null});
   const xTokens=await a.request(r,'/extension-tokens',{link_request_id:r.link_request_id,code:x.code,code_verifier:r.verifier},{'X-Installation-Proof':r.installation_proof});
   r=await a.saveTokens(r,xTokens);return a.publicState(await a.verifyOwner(r));
  }catch(e){const latest=await a.store.get();await a.store.put({...latest,phase:'AUTH_RECOVERY_REQUIRED',owner_user_id:r.owner_user_id,executor_id:r.executor_id,error:this.failure(e.message)});throw e;}
 });}
}
globalThis.FocurveSameOwnerRecovery={SameOwnerRecovery,obligationFields:counts};

})();