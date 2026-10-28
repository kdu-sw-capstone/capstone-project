/* Product lifecycle UI only. Never sends a focus START/END or exposes a tool. */
'use strict';
addEventListener('DOMContentLoaded',()=>{
 const $=id=>document.getElementById(id),start=$('open-user-session'),stop=$('stop-user-session'),status=$('session-status'),link=$('session-dashboard'),popup=$('session-popup');
 const c=globalThis.FOCURVE_NATIVE_LINK_CONFIG;
 if(c?.userSessionEnabled!==true)return;
 $('user-session-section').hidden=false;
 start.hidden=false;let port,launchId,finished=false,pending=false,failed=false;
 let fenceRecorded=false;
 function unavailable(text){
  failed=true;start.disabled=true;stop.disabled=true;link.hidden=true;popup.hidden=true;status.textContent=text;
  // Invalidate only this launch's UI admission. Preserve session/auth/DNR data,
  // the original READY evidence on disk, and any newer launch's admission.
  if(!fenceRecorded&&/^[a-f0-9]{32}$/.test(launchId??'')&&globalThis.navigator?.locks){
   fenceRecorded=true;const lostLaunch=launchId;
   void navigator.locks.request('focurve-user-installation-admission',async()=>{
    const key='focurve_installation_ready_launch',before=await chrome.storage.local.get(key);
    if(before[key]!==lostLaunch)return;
    await chrome.storage.local.set({[key]:null,focurve_installation_channel_failure:{
     contract:'FOCURVE_CHANNEL_FAILURE_1',launchId:lostLaunch,previouslyReady:before[key],
     reason:'PRODUCT_CHANNEL_UNCONFIRMED',atUTC:new Date().toISOString()}});
   }).catch(()=>{/* UI remains failed; a failed fence write never confirms stop. */});
  }
 }
 if(c.contract!=='FOCURVE_NATIVE_LINK_CONFIG_1'||!Number.isFinite(Date.parse(c.notAfterUTC))||Date.now()+900000>=Date.parse(c.notAfterUTC)){
  start.disabled=true;status.textContent='정상 사용 승인 시간이 없거나 안전하게 종료할 시간이 부족합니다. 서비스를 시작하지 않았습니다.';
 }
 // A tab-scoped native port cannot survive closing the owning document.
 // Warn on accidental navigation; never turn a page close into STOP or END.
 addEventListener('beforeunload',event=>{
  if(!globalThis.FOCURVE_PRODUCT_LIFECYCLE_ACTIVE||finished)return;
  event.preventDefault();event.returnValue='';
 });
 const env={chrome,indexedDB,crypto,location,deployment:globalThis.FOCURVE_DEPLOYMENT,context:globalThis.FOCURVE_SAFETY_CONTEXT,core:R2LocalSafety,productLifecycle:true};
 const member=R2LocalSafety.create(env),guest=FocurveGuestSafety.create(env);
 async function observe(){
  const before=await chrome.storage.local.get(['focurve_member_auth','focurve_user_ui_hold']);
  if(before.focurve_user_ui_hold)throw Error('PRODUCT_LOCAL_HOLD');
  const result=await (before.focurve_member_auth?.phase==='LINKED'?member:guest).observe();
  const after=await chrome.storage.local.get(['focurve_member_auth','focurve_user_ui_hold']);
  if(after.focurve_user_ui_hold||JSON.stringify(before.focurve_member_auth)!==JSON.stringify(after.focurve_member_auth))throw Error('PRODUCT_AUTH_CHANGED');
  return result;
 }
 start.addEventListener('click',event=>{
  if(!event.isTrusted||failed||finished||globalThis.FOCURVE_PRODUCT_LIFECYCLE_ACTIVE)return;
  if(c.contract!=='FOCURVE_NATIVE_LINK_CONFIG_1'||c.extensionId!==chrome.runtime.id||!/^[a-f0-9]{32}$/.test(c.installationId??'')||c.host!=='com.focurve.install_'+c.installationId||!Number.isFinite(Date.parse(c.notAfterUTC))||Date.now()+900000>=Date.parse(c.notAfterUTC)){
   status.textContent='승인된 실행 시간이 부족하거나 설치 연결이 일치하지 않습니다. 시작하지 않았습니다.';return;
  }
  globalThis.FOCURVE_PRODUCT_LIFECYCLE_ACTIVE=true;start.disabled=true;
  status.textContent='서비스와 현재 안전 상태를 확인하고 있습니다. 이 창을 열어 두세요.';
  port=chrome.runtime.connectNative(c.host);
  port.onMessage.addListener(async message=>{
   if(failed||finished)return;
   try{
    if(message?.contract!=='FOCURVE_RUNTIME_PROBE_1')throw Error('PRODUCT_MESSAGE_REJECTED');
    if(message.operation==='REJECTED'&&message.code==='PRODUCT_OPERATION_ALREADY_ACTIVE'&&!launchId){
     finished=true;globalThis.FOCURVE_PRODUCT_LIFECYCLE_ACTIVE=false;
     status.textContent='다른 서비스 제어 창에서 이미 실행 중입니다. 이 창에서는 시작하지 않았습니다. 기존 제어 창을 사용하세요.';port.disconnect();return;
    }
    if(message.operation==='SESSION_READY'){
     const r=message.result,deadline=Date.parse(r?.launchDeadlineUTC);
     if(launchId||r?.origin!==globalThis.FOCURVE_DEPLOYMENT?.origin||!/^[a-f0-9]{32}$/.test(r?.launchId??'')||!Number.isFinite(deadline)||deadline>Date.parse(c.notAfterUTC)||deadline<=Date.now()||r.automaticSTART_END!==false)throw Error('PRODUCT_READY_UNCONFIRMED');
     launchId=r.launchId;stop.hidden=false;stop.disabled=false;link.href=r.origin+'/';link.hidden=false;popup.hidden=false;
     status.textContent='서비스가 준비됐습니다. 아래 ‘집중 팝업을 새 탭으로 열기’를 누르세요. 이 제어 탭의 주소를 바꾸거나 새로고침·닫기 하지 마세요.';return;
    }
    if(message.operation==='STOPPING'){
     if(!launchId||message.installationId!==c.installationId||message.extensionId!==c.extensionId||message.launchId!==launchId||!['USER_REQUEST','DEADLINE_RESERVE'].includes(message.reason))throw Error('PRODUCT_STOP_SCOPE_UNCONFIRMED');
     stop.disabled=true;link.hidden=true;popup.hidden=true;
     status.textContent='정상 종료 요청을 접수했습니다. 현재 안전 상태와 서비스 종료를 확인하고 있습니다. 완료 안내가 나올 때까지 이 창을 닫지 마세요.';return;
    }
    if(message.operation==='COMPLETE'){
     if(message.result?.state!=='USER_SESSION_STOPPED'||message.result?.normalShutdowns!==1||message.result?.servicesRunning!==false||message.result?.focusAdmission!=='CLOSED')throw Error('PRODUCT_STOP_UNCONFIRMED');
     finished=true;stop.disabled=true;link.hidden=true;popup.hidden=true;globalThis.FOCURVE_PRODUCT_LIFECYCLE_ACTIVE=false;
     status.textContent='현재 안전 상태를 확인하고 서비스를 정상 종료했습니다. 데이터는 보존했습니다.';port.disconnect();return;
    }
    if(message.operation==='FAILED'){
     unavailable('현재 상태를 보존하고 중단했습니다. 서비스 종료 여부는 확인할 수 없습니다. 재시작·집중 시작·종료를 반복하지 마세요.');port.disconnect();return;
    }
    if(pending||message.installationId!==c.installationId||message.extensionId!==c.extensionId||!/^[a-f0-9]{32}$/.test(message.nonce??''))throw Error('PRODUCT_SCOPE_UNCONFIRMED');
    pending=true;let result;
    if(message.operation==='CHECK_LOCAL')result=await observe();
    else if(['PREPARE_CLOSED','OPEN_PREPARED','QUIESCE'].includes(message.operation)){
     const reply=await chrome.runtime.sendMessage({type:'PRODUCT_RUNTIME_FENCE',operation:message.operation,scope:message.payload});
     if(reply?.ok!==true)throw Error('PRODUCT_FENCE_UNCONFIRMED');result=reply.result;
    }else throw Error('PRODUCT_OPERATION_REJECTED');
    if(failed||finished)return;
    port.postMessage({contract:message.contract,nonce:message.nonce,installationId:c.installationId,extensionId:c.extensionId,ok:true,result});pending=false;
   }catch{
    if(failed||finished)return;
    unavailable('결과를 확인하지 못해 중단했습니다. 서비스 종료 여부는 확인할 수 없습니다. 재실행하지 마세요.');
    try{port.postMessage({contract:'FOCURVE_RUNTIME_PROBE_1',ok:false});}catch{}
   }
  });
  port.onDisconnect.addListener(()=>{void chrome.runtime.lastError;if(!finished&&!failed)unavailable('제품 연결이 끊겼습니다. 서비스 종료 여부는 확인할 수 없습니다. 현재 기록과 창을 보존하고 재실행하지 마세요.');});
  port.postMessage({contract:'FOCURVE_RUNTIME_PROBE_1',operation:'OPEN_USER_SESSION',installationId:c.installationId,extensionId:c.extensionId});
 });
 stop.addEventListener('click',event=>{
  if(!event.isTrusted||failed||finished||stop.disabled||!port||!launchId)return;
  stop.disabled=true;status.textContent='정상 종료를 요청했습니다. 완료 안내가 나올 때까지 이 창을 닫지 마세요. 집중 중이거나 미해소 의무가 있으면 종료하지 않고 보존합니다.';
  port.postMessage({contract:'FOCURVE_RUNTIME_PROBE_1',operation:'STOP_USER_SESSION',installationId:c.installationId,extensionId:c.extensionId,launchId});
 });
 addEventListener('pagehide',()=>{member.cancel();guest.cancel();},{once:true});
});
