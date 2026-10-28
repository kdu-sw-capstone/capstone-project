// Independent composition: retain the standard Guest Popup auth envelope using ONE auth actor.
// The legacy auth runtime is not loaded alongside the MEMBER A1 composition.
(() => {
 const types=new Set(['FOCURVE_AUTH_STATUS','FOCURVE_AUTH_BEGIN','FOCURVE_AUTH_POLL']);
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(!types.has(message?.type))return;
  if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('popup/popup.html')||sender.frameId&&sender.frameId!==0||typeof message.request_id!=='string'||!message.request_id.length||message.request_id.length>64)return;
  Promise.resolve().then(async()=>{
   if(message.type==='FOCURVE_AUTH_STATUS')return __memberIntegration.auth.status();
   if(message.type==='FOCURVE_AUTH_BEGIN')return __memberIntegration.connect(message.payload);
   const state=await __memberIntegration.pollLink();if(state.phase==='LINKED')await initializeMemberA1();return state;
  }).then(data=>respond({request_id:message.request_id,status:'OK',data,error:null}),async error=>{
   let data=null;try{data=await __memberIntegration.auth.status();}catch{}
   const allowed=['GUEST_SESSION_ACTIVE','ACCOUNT_TRANSITION_ACTIVE','AUTH_SERVER_BOUND','INVALID_SERVER_CONFIG','INSTALLATION_EXISTS','INVALID_CALLBACK','INVALID_INSTALLATION','INVALID_STATE','LINK_EXPIRED','INVALID_GRANT','TOKEN_REUSE','IDENTITY_ALREADY_LINKED','ACTIVE_SESSION_EXISTS','EXECUTION_EVIDENCE_REQUIRED','RELEASE_UNCONFIRMED','INVALID_TOKEN','UNAUTHENTICATED','AUTH_RESPONSE_UNCONFIRMED','INVALID_AUTH_RESPONSE','AUTH_OWNER_MISMATCH'];
   respond({request_id:message.request_id,status:'ERROR',data,error:{code:allowed.includes(error.message)?error.message:'AUTH_OPERATION_FAILED'}});
  });return true;
 });
})();
