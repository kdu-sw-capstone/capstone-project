importScripts(chrome.runtime.getURL('integration/member-import.bundle.js'));
// Independent UI adapter; original Guest Popup and all Content channels retain their contracts.
chrome.alarms.create('focurve-member-server-poll',{periodInMinutes:0.5});
chrome.alarms.onAlarm.addListener(a=>{
 if(a.name!=='focurve-member-server-poll'||!globalThis.__memberA1)return;
 // Ordinary polling must share the service/QUIESCE fence. Never refresh against
 // stopped services, including while admission has not finished initializing.
 Promise.resolve().then(()=>{
  const admission=globalThis.FocurveUserAdmission;
  if(typeof admission?.withServices!=='function')throw Error('INSTALLATION_NOT_READY');
  return admission.withServices(()=>globalThis.__memberA1?.tick());
 }).catch(e=>console.warn('MEMBER_SERVER_POLL_UNCONFIRMED',e.message));
});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(message?.type!=='INDEPENDENT_MEMBER_UI')return;
 if(sender.frameId&&sender.frameId!==0||sender.id!==chrome.runtime.id||!(sender.url===chrome.runtime.getURL('member-ui/popup.html')||globalThis.FOCURVE_DEPLOYMENT?.developerDiagnostics===true&&sender.url===chrome.runtime.getURL('member-ui/developer.html'))||!/^[-0-9a-f]{36}$/.test(message.request_id??'')){respond({ok:false,error:'UNAUTHORIZED_SENDER'});return false;}
 Promise.resolve().then(async()=>{const m=message;switch(m.action){case 'SETTINGS_LIST':return (await memberGuestImporter()).settingsList();case 'SETTINGS_SELECTED':return (await memberGuestImporter()).settingsSelected(m.payload.ids);case 'IMPORT_LIST':return (await memberGuestImporter()).list();case 'IMPORT_SELECTED':return (await memberGuestImporter()).selected(m.payload.ids);case 'RECOVER_BEGIN':{const r=await MemberRecovery.begin(m.payload);return {...r,...await MemberRecovery.status()};}case 'RECOVER_CONFIRM':{const r=await MemberRecovery.confirm();return {...r,...await MemberRecovery.status()};}case 'CONNECT':return __memberIntegration.connect(m.payload);case 'CLAIM':{const s=await __memberIntegration.pollLink();if(s.phase==='LINKED')await initializeMemberA1();return s;}case 'STATE':{const auth=await __memberIntegration.auth.status();if(auth.phase!=='LINKED')return {...auth,...(globalThis.__memberA1?await __memberA1.status():{local_status:'AUTH_HOLD'}),authentication_hold:true,server_confirmed_running:false,...await MemberRecovery.status()};if(globalThis.__memberA1){try{await __memberA1.identity();}catch{return {phase:'AUTH_RECOVERY_REQUIRED',local_status:'UNKNOWN',restoration_obligation_preserved:true};}}return {...auth,...(globalThis.__memberA1?await __memberA1.status():{}),feature_record_quality:(await memberFeatureQuality()).quality};}case 'DISCONNECT':{if(!globalThis.__memberA1)throw Error('MEMBER_AUTH_REQUIRED');const result=await __memberA1.disconnect();globalThis.__memberA1=undefined;memberAccessInit=undefined;return result;}case 'START':if(!globalThis.__memberA1)throw Error('MEMBER_AUTH_REQUIRED');{const result=await FocurveUserAdmission.start(()=>__memberA1.start(m.payload.minutes,m.request_id),m.payload.minutes);await seedMemberFeatureBaseline();return result;}case 'SYNC':if(!globalThis.__memberA1)throw Error('MEMBER_AUTH_REQUIRED');{const result=await __memberA1.tick();await seedMemberFeatureBaseline();return result;}case 'END':if(!globalThis.__memberA1)throw Error('MEMBER_AUTH_REQUIRED');return __memberA1.end();default:throw Error('UNKNOWN_UI_ACTION');}}).then(data=>respond({ok:true,data}),e=>respond({ok:false,error:e.message}));return true;
});




let memberImportActor;async function memberGuestImporter(){
 const adapter=globalThis.__memberA1;if(!adapter)throw Error('MEMBER_AUTH_REQUIRED');
 if(memberImportActor?.adapter===adapter)return memberImportActor.actor;
 const getIdentity=async()=>{const i=await adapter.identity();return {owner_user_id:i.owner_key.slice(7),executor_id:i.executor_id,authority:i.authority};};
 const send=async(path,body,method,key)=>{const i=await getIdentity(),c=await __memberIntegration.auth.credentials();if(c.owner_key!=='MEMBER:'+i.owner_user_id||c.executor_id!==i.executor_id)throw Error('OWNER_MISMATCH');const response=await fetch(i.authority+path,{method,credentials:'omit',redirect:'error',cache:'no-store',headers:{Authorization:'Bearer '+c.access_token,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});const result=await response.json();if(!response.ok)throw Error('IMPORT_HTTP_'+response.status+':'+result.error?.code);return result;};
 const actor=new MemberGuestImporter({db:SessionDB,getIdentity,send,digest:MemberA1Contract.digest,getSettings:async i=>{const local=await LocalStore.guestContext();if(local.installation_id!==i.executor_id)throw Error('OWNER_MISMATCH');return GuestSites.list();}});memberImportActor={adapter,actor};return actor;
}
