/* Product-owned runtime probe. User click only; no AI observation endpoint. */
'use strict';
addEventListener('DOMContentLoaded',()=>{
 const button=document.querySelector('#verify-runtime'),status=document.querySelector('#runtime-status');let active=false,finished=false;
 if(!globalThis.FOCURVE_NATIVE_LINK_CONFIG||globalThis.FOCURVE_NATIVE_LINK_CONFIG.productHoldRecoveryEnabled===true)return;
 button.hidden=false;
 if(!Number.isFinite(Date.parse(globalThis.FOCURVE_NATIVE_LINK_CONFIG.notAfterUTC))||Date.now()+240000>=Date.parse(globalThis.FOCURVE_NATIVE_LINK_CONFIG.notAfterUTC)){
  button.disabled=true;status.textContent='서비스 검증 승인 시간이 없거나 안전하게 완료할 시간이 부족합니다. 시작하지 않았습니다.';
 }
 addEventListener('beforeunload',event=>{if(active&&!finished){event.preventDefault();event.returnValue='';}});
 const env={chrome,indexedDB,crypto,location,deployment:globalThis.FOCURVE_DEPLOYMENT,context:globalThis.FOCURVE_SAFETY_CONTEXT,core:R2LocalSafety,productLifecycle:true};
 const member=R2LocalSafety.create(env),guest=FocurveGuestSafety.create(env);
 const observe=async()=>{
  const before=await chrome.storage.local.get(['focurve_member_auth','focurve_user_ui_hold']);if(before.focurve_user_ui_hold)throw Error('PRODUCT_LOCAL_HOLD');
  const r=await (before.focurve_member_auth?.phase==='LINKED'?member:guest).observe();
  const after=await chrome.storage.local.get(['focurve_member_auth','focurve_user_ui_hold']);if(after.focurve_user_ui_hold||JSON.stringify(before.focurve_member_auth)!==JSON.stringify(after.focurve_member_auth))throw Error('PRODUCT_AUTH_CHANGED');return r;
 };
 button.addEventListener('click',event=>{
  if(!event.isTrusted||active||globalThis.FOCURVE_PRODUCT_LIFECYCLE_ACTIVE)return;const c=globalThis.FOCURVE_NATIVE_LINK_CONFIG;
  if(!c||c.contract!=='FOCURVE_NATIVE_LINK_CONFIG_1'||c.extensionId!==chrome.runtime.id||!Number.isFinite(Date.parse(c.notAfterUTC))||Date.now()+240000>=Date.parse(c.notAfterUTC)){status.textContent='이번 실행 기한 안에 안전하게 완료할 시간이 부족합니다. 시작하지 않았습니다.';return;}
  active=true;globalThis.FOCURVE_PRODUCT_LIFECYCLE_ACTIVE=true;button.disabled=true;status.textContent='서비스와 안전 상태를 확인하고 있습니다. 이 창을 닫지 마세요.';
  const port=chrome.runtime.connectNative(c.host);let pending=false;
  port.onMessage.addListener(async message=>{
   try{
    if(message?.contract!=='FOCURVE_RUNTIME_PROBE_1')throw Error('PRODUCT_MESSAGE_REJECTED');
    if(message.operation==='REJECTED'&&message.code==='PRODUCT_OPERATION_ALREADY_ACTIVE'){
     finished=true;globalThis.FOCURVE_PRODUCT_LIFECYCLE_ACTIVE=false;status.textContent='다른 서비스 제어 창에서 이미 실행 중입니다. 이 창에서는 검증을 시작하지 않았습니다.';port.disconnect();return;
    }
    if(message.operation==='COMPLETE'){
     const r=message.result;if(r?.state!=='VERIFIED_STOPPED'||r.normalShutdowns!==2||r.focusAdmission!=='CLOSED'||!r.restart||!r.schemaAndRowCountsPreserved)throw Error('PRODUCT_RESULT_UNCONFIRMED');
     finished=true;globalThis.FOCURVE_PRODUCT_LIFECYCLE_ACTIVE=false;status.textContent='Web·Server·MySQL 기동, 자체 안전 조회, 정상 종료, 재기동·DB 행 수 보존 확인을 완료했습니다. 현재 서비스는 종료됐고 집중은 실행하지 않았습니다.';port.disconnect();return;
    }
    if(message.operation==='FAILED'){finished=true;status.textContent='검증을 중단하고 현재 상태를 보존했습니다. 재시작하거나 집중을 누르지 마세요.';port.disconnect();return;}
    if(pending||message.installationId!==c.installationId||message.extensionId!==chrome.runtime.id||!/^[a-f0-9]{32}$/.test(message.nonce??''))throw Error('PRODUCT_SCOPE_UNCONFIRMED');pending=true;
    let result;
    if(message.operation==='CHECK_LOCAL')result=await observe();
    else if(['BIND_CLOSED','QUIESCE'].includes(message.operation)){
     const response=await chrome.runtime.sendMessage({type:'PRODUCT_RUNTIME_FENCE',operation:message.operation,scope:message.payload});if(response?.ok!==true)throw Error('PRODUCT_FENCE_UNCONFIRMED');result=response.result;
    }else throw Error('PRODUCT_OPERATION_REJECTED');
    port.postMessage({contract:message.contract,nonce:message.nonce,installationId:c.installationId,extensionId:chrome.runtime.id,ok:true,result});pending=false;
   }catch{try{port.postMessage({contract:'FOCURVE_RUNTIME_PROBE_1',ok:false});}catch{}status.textContent='안전 상태를 확정하지 못해 중단했습니다. 이 창과 기록을 보존하세요.';}
  });
  port.onDisconnect.addListener(()=>{void chrome.runtime.lastError;if(!finished)status.textContent='제품 연결이 중단됐습니다. 재실행하지 말고 현재 창과 기록을 보존하세요.';});
  port.postMessage({contract:'FOCURVE_RUNTIME_PROBE_1',operation:'VERIFY_RUNTIME',installationId:c.installationId,extensionId:chrome.runtime.id});
 });
 addEventListener('pagehide',()=>{member.cancel();guest.cancel();},{once:true});
});
