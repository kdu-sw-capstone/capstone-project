// Existing CONNECT/WAKE protocol; hints never authorize APPLY/END and return no credentials.
function installMemberWebBridge({runtime=chrome.runtime,auth=__memberIntegration.auth,initialize=initializeMemberA1,baseline=()=>seedMemberFeatureBaseline()}={}){
 let running=null,dirty=false;
 const same=(a,b)=>['phase','owner_user_id','executor_id','server_url','web_origin'].every(k=>a[k]===b[k]);
 const services=operation=>globalThis.FocurveUserAdmission?globalThis.FocurveUserAdmission.withServices(operation):operation();
 function lookup(){dirty=true;if(!running)running=(async()=>{let state;do{dirty=false;state=await services(async()=>{const actor=await initialize();if(!actor)throw Error('MEMBER_AUTH_REQUIRED');await actor.identity();const current=await actor.tick();await baseline();return current;});}while(dirty);return state;})().finally(()=>{running=null;});return running;}
 runtime.onMessageExternal.addListener((m,sender,respond)=>{
  if(sender.id||sender.frameId!==0||!Number.isInteger(sender.tab?.id)||!m||Object.keys(m).sort().join(',')!=='owner_context,payload,request_id,type'||!['FOCURVE_EXECUTION_CONNECT','FOCURVE_EXECUTION_WAKE'].includes(m.type)||m.owner_context!==null||typeof m.request_id!=='string'||!m.request_id.length||m.request_id.length>64||!m.payload||Array.isArray(m.payload)||typeof m.payload!=='object'||(m.type==='FOCURVE_EXECUTION_CONNECT'?Object.keys(m.payload).length!==0:Object.keys(m.payload).join(',')!=='executor_id'||!/^[-0-9a-f]{36}$/i.test(m.payload.executor_id??'')))return;
  (async()=>{const before=await services(()=>auth.status());let origin;try{origin=new URL(sender.url).origin;}catch{return{received:false};}if(before.phase!=='LINKED'||origin!==before.web_origin||sender.origin&&sender.origin!==origin)return{received:false};
   if(m.type==='FOCURVE_EXECUTION_WAKE'){if(before.executor_id!==m.payload.executor_id)return{received:false};lookup().catch(()=>console.warn('MEMBER_WEB_WAKE_UNCONFIRMED'));return{received:true};}
   const state=await lookup(),after=await services(()=>auth.status());if(!same(before,after)||after.phase!=='LINKED'||['UNKNOWN','UNCONFIRMED','RECOVERY_REQUIRED','AUTH_RECOVERY_REQUIRED'].includes(state.local_status??state.status))throw Error('CONNECTION_UNCONFIRMED');return{executor_id:before.executor_id};
  })().then(data=>respond({request_id:m.request_id,status:'OK',data,error:null}),()=>respond({request_id:m.request_id,status:'ERROR',data:null,error:{code:'WAKE_UNAVAILABLE'}}));return true;
 });
}
if(typeof chrome!=='undefined'&&globalThis.__memberIntegration)installMemberWebBridge();

// Existing Web import contract (11 section72-78). No automatic list/upload.
function installMemberWebImportBridge({runtime=chrome.runtime,auth=__memberIntegration.auth,getImporter=memberGuestImporter}={}){
 const active=new Set(),same=(a,b)=>['phase','owner_user_id','executor_id','server_url','web_origin'].every(k=>a[k]===b[k]);
 runtime.onMessageExternal.addListener((m,sender,respond)=>{
  if(!['FOCURVE_GUEST_IMPORT_LIST','FOCURVE_GUEST_IMPORT_SUBMIT'].includes(m?.type))return;
  const deny=()=>{respond({error:{code:'IMPORT_UNAVAILABLE'}});return false;};
  if(sender.id||sender.frameId!==0||!Number.isInteger(sender.tab?.id)||m.version!=='1.0'||typeof m.owner_user_id!=='string'||!/^\d{1,20}$/.test(m.owner_user_id))return deny();
  const keys=m.type.endsWith('LIST')?'owner_user_id,type,version':'executor_id,items,owner_user_id,request_id,type,version';if(Object.keys(m).sort().join(',')!==keys)return deny();
  (async()=>{const before=await auth.status();let origin;try{origin=new URL(sender.url).origin;}catch{throw Error('IMPORT_UNAVAILABLE');}
   if(before.phase!=='LINKED'||before.owner_user_id!==m.owner_user_id||origin!==before.web_origin||sender.origin&&sender.origin!==origin)throw Error('IMPORT_UNAVAILABLE');
   const actor=await getImporter();let data;if(m.type.endsWith('LIST'))data=await actor.webList(m.owner_user_id);
   else{if(before.executor_id!==m.executor_id||active.has(before.executor_id))throw Error('IMPORT_UNAVAILABLE');active.add(before.executor_id);try{data=await actor.webSelected(m);}finally{active.delete(before.executor_id);}}
   if(!same(before,await auth.status()))throw Error('IMPORT_UNAVAILABLE');return data;
  })().then(respond,()=>respond({error:{code:'IMPORT_UNAVAILABLE'}}));return true;
 });
}
if(typeof chrome!=='undefined'&&globalThis.__memberIntegration)installMemberWebImportBridge();
